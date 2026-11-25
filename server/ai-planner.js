/**
 * ai-planner.js — geração server-side do plano semanal.
 * Chamado pelo endpoint POST /api/planner/generate.
 * Lê dados direto do SQLite, chama Gemini via HTTP, persiste o resultado.
 */

import { kvStore } from './db.js';
import { callAi } from './aiProvider.js';
import { targetWeekOf } from '../src/shared/planner/planWeek.js';
import { localDayKey } from '../src/shared/dates/localDay.js';

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

function buildPrompt() {
  const today = localDayKey();
  return `Você é um assistente de planejamento de vida. Crie uma agenda semanal COMPLETA — não só estudo, mas tudo: treinos, revisões, descanso, tarefas administrativas.

Data de hoje: ${today}

--- BLOCOS DE HORÁRIO DISPONÍVEIS ---
${routineLines()}

--- FÍSICO: Histórico de treinos ---
${fitnessLines()}

--- ACADÊMICO: Próximas avaliações ---
${examLines()}

REGRAS CRÍTICAS:
1. Use os horários disponíveis na rotina. startTime deve caber dentro de um bloco.
2. type deve ser: "study", "review", "train", "rest", "admin", "other".
3. ADAPTAÇÃO AUTOMÁTICA: se houver prova em 1-3 dias, priorize revisão nessa matéria.
4. Inclua sessões de treino físico baseadas no histórico de treinos.
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

export async function generateAndSaveWeeklyPlan() {
  const prompt = `${buildPrompt()}\n\nResponda APENAS com JSON válido.`;
  const raw = await callAi(prompt, { temperature: 0.3 });
  const parsed = JSON.parse(extractJson(raw));

  if (!Array.isArray(parsed)) throw new Error('A IA não retornou um array JSON válido.');

  // Same rule as the app's "no plan this week" alert — they used to differ
  // (here only after 16h on Sunday), so a Sunday-morning plan looked missing.
  const weekOf = targetWeekOf();

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
