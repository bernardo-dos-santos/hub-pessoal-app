/**
 * ai-planner.js — geração server-side do plano semanal.
 * Chamado pelo endpoint POST /api/planner/generate.
 * Lê dados direto do SQLite, chama Gemini via HTTP, persiste o resultado.
 */

import { kvStore } from './db.js';
import { callAi } from './aiProvider.js';

const WEEK_DAY_LABEL = {
  sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado',
};

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function getKey(key) {
  const raw = kvStore.get(key);
  return raw ? safeJson(raw) : null;
}

// ── Helpers de contexto (espelham aiWeeklyPlanService.ts do frontend) ─────────

function routineLines() {
  const routine = getKey('planner.routine') ?? { days: [] };
  if (!routine.days?.length) return '  (rotina não configurada)';
  return routine.days.map((d) => {
    if (!d.available || !d.blocks?.length)
      return `  - ${WEEK_DAY_LABEL[d.day] ?? d.day}: indisponível`;
    const blocks = d.blocks.map((b) => `${b.start}–${b.end}`).join(', ');
    const note = d.commitment?.trim() ? ` (${d.commitment})` : '';
    return `  - ${WEEK_DAY_LABEL[d.day] ?? d.day}: ${blocks}${note}`;
  }).join('\n');
}

function tafLines() {
  const workouts = getKey('fitness.workouts') ?? [];
  const requirements = [
    { id: 'running', testName: 'Corrida 2400m', workoutType: 'running', minimumValue: 2400, unit: 'm', higherIsBetter: true },
    { id: 'sit_up',  testName: 'Abdominal',     workoutType: 'sit_up',  minimumValue: 38,   unit: 'reps', higherIsBetter: true },
    { id: 'push_up', testName: 'Flexão',         workoutType: 'push_up', minimumValue: 28,   unit: 'reps', higherIsBetter: true },
    { id: 'pull_up', testName: 'Barra',          workoutType: 'pull_up', minimumValue: 7,    unit: 'reps', higherIsBetter: true },
  ];
  return requirements.map((req) => {
    const typeWorkouts = workouts.filter((w) => w.type === req.workoutType);
    const bestValue = typeWorkouts.length > 0
      ? Math.max(...typeWorkouts.map((w) => req.workoutType === 'running' ? (w.distanceMeters ?? 0) : (w.reps ?? 0)).filter((v) => v > 0))
      : null;
    const pct = bestValue !== null ? Math.round((bestValue / req.minimumValue) * 100) : 0;
    const gap = bestValue !== null && bestValue < req.minimumValue ? ` (falta ${req.minimumValue - bestValue} ${req.unit})` : '';
    return `  - ${req.testName}: ${bestValue ?? 'sem dado'} ${req.unit} / mínimo ${req.minimumValue} ${req.unit} — ${pct}%${gap}`;
  }).join('\n');
}

function fitnessLines() {
  const workouts = (getKey('fitness.workouts') ?? []).slice(0, 5);
  if (!workouts.length) return '  - Nenhum treino registrado';
  return workouts.map((w) => `  - ${w.date}: ${w.type}${w.distanceMeters ? ` ${w.distanceMeters}m` : ''}${w.reps ? ` ${w.reps} reps` : ''}`).join('\n');
}

function examLines() {
  const assessments = getKey('college.assessments') ?? [];
  const subjects = getKey('college.subjects') ?? [];
  const today = new Date();
  const upcoming = assessments
    .filter((a) => a.status === 'scheduled' && a.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  if (!upcoming.length) return '  (sem avaliações agendadas)';
  return upcoming.map((a) => {
    const sub = subjects.find((s) => s.id === a.subjectId);
    const daysUntil = Math.round((new Date(a.date).getTime() - today.getTime()) / 86400000);
    const urgency = daysUntil <= 1 ? ' ⚠ AMANHÃ' : daysUntil <= 3 ? ` (em ${daysUntil} dias — URGENTE)` : ` (em ${daysUntil} dias)`;
    return `  - ${sub?.name ?? a.subjectId}: ${a.title} em ${a.date}${urgency}`;
  }).join('\n');
}

function abinCheckInLines() {
  const checkIns = getKey('concurso.abin.checkIns') ?? [];
  if (!checkIns.length) return '  (nenhum check-in registrado)';
  const last4 = checkIns.slice(0, 4);
  return last4.map((ci) =>
    `  - Semana ${ci.weekStart}: ${ci.hoursStudied}h estudadas` +
    (ci.questionsResolved > 0 ? `, ${ci.questionsResolved} questões (${ci.accuracyPct}%)` : '') +
    (ci.trainingDone ? ', treinou' : ', sem treino')
  ).join('\n');
}

function buildPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `Você é um assistente de planejamento de vida. Crie uma agenda semanal COMPLETA — não só estudo, mas tudo: treinos, revisões, descanso, tarefas administrativas.

Data de hoje: ${today}

--- BLOCOS DE HORÁRIO DISPONÍVEIS ---
${routineLines()}

--- FÍSICO: Status TAF (Bombeiros SC) ---
${tafLines()}

--- FÍSICO: Histórico de treinos ---
${fitnessLines()}

--- ACADÊMICO: Próximas avaliações ---
${examLines()}

--- CONCURSO ABIN: Check-ins semanais recentes ---
${abinCheckInLines()}

REGRAS CRÍTICAS:
1. Use os horários disponíveis na rotina. startTime deve caber dentro de um bloco.
2. type deve ser: "study", "review", "train", "rest", "admin", "other".
3. ADAPTAÇÃO AUTOMÁTICA: se houver prova em 1-3 dias, priorize revisão nessa matéria.
4. Inclua sessões de treino físico baseadas nos gaps do TAF.
5. Nomes dos dias em inglês. startTime no formato "HH:MM".

Retorne APENAS array JSON sem markdown:
[{"day":"monday","startTime":"19:00","type":"study","topic":"...","durationMinutes":60,"priority":"high|medium|low","reason":"..."}]`;
}

function extractJson(text) {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  if (fenced) return fenced[1].trim();
  const first = text.search(/[[\{]/);
  if (first === -1) return text.trim();
  const last = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  return text.slice(first, last + 1).trim();
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getNextMondayFrom(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export async function generateAndSaveWeeklyPlan() {
  const prompt = `${buildPrompt()}\n\nResponda APENAS com JSON válido.`;
  const raw = await callAi(prompt, { temperature: 0.3 });
  const parsed = JSON.parse(extractJson(raw));

  if (!Array.isArray(parsed)) throw new Error('A IA não retornou um array JSON válido.');

  const today = new Date();
  const isAfterSunday16h = today.getDay() === 0 && today.getHours() >= 16;
  const weekOf = isAfterSunday16h
    ? getNextMondayFrom(today)
    : getMondayOf(today);

  const sessions = parsed
    .filter((s) => s && typeof s.topic === 'string' && typeof s.durationMinutes === 'number')
    .map((s) => ({ ...s, id: generateId() }));

  const plan = {
    id: generateId(),
    weekOf,
    generatedAt: new Date().toISOString(),
    sessions,
  };

  kvStore.set('planner.weeklyPlan', JSON.stringify(plan));
  return { ok: true, sessions: sessions.length, weekOf };
}
