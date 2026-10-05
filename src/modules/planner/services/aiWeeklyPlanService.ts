import { aiClient } from '../../../core/ai/aiClient';
import { errorNotebookService } from '../../study/services/errorNotebookService';
import { simuladoService } from '../../study/services/simuladoService';
import { subjectService } from '../../college/services/subjectService';
import { assessmentService } from '../../college/services/assessmentService';
import { gradeService } from '../../college/services/gradeService';
import { workoutService } from '../../fitness/services/workoutService';
import { tafService } from '../../fitness/services/tafService';
import { fitnessStatisticsService } from '../../fitness/services/fitnessStatisticsService';
import { routineService } from './routineService';
import { WEEK_DAY_LABEL, ACTIVITY_LABEL, PLANNABLE_ACTIVITIES, type ActivityType, type SessionType, type WeeklySession } from '../types/routine';

// ── Helpers de contexto ───────────────────────────────────────────────────────

function tagAccuracy(): Record<string, number> {
  const archivedTags = subjectService.listArchivedSubjectTags();
  const acc: Record<string, { c: number; t: number }> = {};
  for (const r of simuladoService.listResults()) {
    for (const s of r.byTag) {
      if (archivedTags.has(s.tag)) continue;
      if (!acc[s.tag]) acc[s.tag] = { c: 0, t: 0 };
      acc[s.tag].c += s.correct;
      acc[s.tag].t += s.total;
    }
  }
  return Object.fromEntries(
    Object.entries(acc).map(([k, v]) => [k, Math.round((v.c / v.t) * 100)])
  );
}

function errorCounts(): Record<string, number> {
  const archivedTags = subjectService.listArchivedSubjectTags();
  const counts: Record<string, number> = {};
  for (const e of errorNotebookService.listPending()) {
    if (archivedTags.has(e.subjectTag)) continue;
    counts[e.subjectTag] = (counts[e.subjectTag] ?? 0) + e.timesFailed;
  }
  return counts;
}

function upcomingExams() {
  const activeSubjectIds = new Set(subjectService.listActiveSubjects().map((s) => s.id));
  const subjects = subjectService.listSubjects();
  return assessmentService
    .listAssessments()
    .filter((a) => a.status === 'scheduled' && a.date && activeSubjectIds.has(a.subjectId))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 8)
    .map((a) => {
      const s = subjects.find((x) => x.id === a.subjectId);
      return { name: `${s?.name ?? a.subjectId}: ${a.title}`, date: a.date ?? '' };
    });
}

function subjectGrades() {
  return subjectService.listActiveSubjects().map((s) => {
    const avg = gradeService.getAverageBySubject(s.id);
    return `${s.name}: ${avg !== null ? avg.toFixed(1) : 'sem notas'}`;
  });
}

function tafContext() {
  try {
    const results = tafService.getAllTestResults();
    if (results.length === 0) return '  (sem dados do TAF ainda)';
    return results.map((r) => {
      const best = r.bestValue ?? 0;
      const min  = r.requirement.minimumValue;
      const pct  = min > 0 ? Math.round((best / min) * 100) : 0;
      const status = pct >= 100 ? '✓' : pct >= 90 ? '~' : '✗';
      return `  - ${r.requirement.workoutType}: ${best} (mínimo ${min}) ${status} ${pct}%`;
    }).join('\n');
  } catch { return '  (dados TAF indisponíveis)'; }
}

function fitnessContext() {
  const daysSince = fitnessStatisticsService.getDaysSinceLastWorkout();
  const thisWeek  = fitnessStatisticsService.getWorkoutsThisWeek();
  const last      = workoutService.listWorkouts().slice(0, 3).map((w) =>
    `${w.date} — ${w.type}`
  );
  return [
    `  - Último treino: ${daysSince === null ? 'nunca' : `há ${daysSince} dia(s)`}`,
    `  - Treinos essa semana: ${thisWeek}`,
    last.length > 0 ? `  - Últimos: ${last.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

function parseSessionsFromAI(raw: unknown): Omit<WeeklySession, 'id'>[] {
  if (!Array.isArray(raw)) throw new Error('Resposta inválida da IA.');
  const validDays  = new Set(['sunday','monday','tuesday','wednesday','thursday','friday','saturday']);
  const validTypes = new Set<string>(['study','review','train','rest','admin','other']);
  const timeRe     = /^\d{2}:\d{2}$/;
  return (raw as WeeklySession[]).filter(
    (s) =>
      s &&
      typeof s.topic === 'string' &&
      typeof s.durationMinutes === 'number' &&
      s.durationMinutes > 0 &&
      validDays.has(s.day) &&
      timeRe.test(s.startTime ?? '') &&
      validTypes.has(s.type ?? ''),
  );
}

// ── Geração principal ─────────────────────────────────────────────────────────

export async function generateWeeklyPlan(): Promise<Omit<WeeklySession, 'id'>[]> {
  const routine  = routineService.getRoutine();
  const accuracy = tagAccuracy();
  const errors   = errorCounts();
  const exams    = upcomingExams();
  const grades   = subjectGrades();

  const today     = new Date();
  const todayStr  = today.toISOString().split('T')[0];

  const routineLines = routine.days.map((d) => {
    if (!d.available || d.blocks.length === 0)
      return `  - ${WEEK_DAY_LABEL[d.day]}: indisponível`;
    const wakeNote  = d.wakeTime  ? ` | acorda ${d.wakeTime}`  : '';
    const sleepNote = d.sleepTime ? ` | dorme ${d.sleepTime}`  : '';
    const blocks = d.blocks.map((b) => {
      const act = b.activity ? ACTIVITY_LABEL[b.activity] : 'Livre';
      const plannable = !b.activity || PLANNABLE_ACTIVITIES.has(b.activity as ActivityType);
      return `${b.start}–${b.end} ${act}${plannable ? ' (disponível)' : ''}`;
    }).join(', ');
    const note = d.commitment.trim() ? ` — ${d.commitment}` : '';
    return `  - ${WEEK_DAY_LABEL[d.day]}${wakeNote}${sleepNote}: ${blocks}${note}`;
  }).join('\n');

  const accLines = Object.entries(accuracy).length > 0
    ? Object.entries(accuracy)
        .sort(([, a], [, b]) => a - b).slice(0, 10)
        .map(([tag, pct]) => `  - ${tag}: ${pct}%`).join('\n')
    : '  (nenhum simulado ainda)';

  const errLines = Object.entries(errors).length > 0
    ? Object.entries(errors).sort(([, a], [, b]) => b - a).slice(0, 8)
        .map(([tag, n]) => `  - ${tag}: ${n} erro(s)`).join('\n')
    : '  (caderno vazio)';

  const examLines = exams.length > 0
    ? exams.map((e) => {
        const daysUntil = Math.round(
          (new Date(e.date).getTime() - today.getTime()) / 86400000
        );
        const urgency = daysUntil <= 1 ? ' ⚠ AMANHÃ' : daysUntil <= 3 ? ` (em ${daysUntil} dias — URGENTE)` : ` (em ${daysUntil} dias)`;
        return `  - ${e.name} em ${e.date}${urgency}`;
      }).join('\n')
    : '  (sem avaliações agendadas)';

  const prompt = `Você é um assistente de planejamento de vida. Crie uma agenda semanal COMPLETA — não só estudo, mas tudo: treinos, revisões, descanso, tarefas administrativas.

Data de hoje: ${todayStr}

--- BLOCOS DE HORÁRIO DISPONÍVEIS ---
${routineLines}

--- ACADÊMICO: Desempenho nos simulados (pior → melhor) ---
${accLines}

--- ACADÊMICO: Caderno de erros pendentes ---
${errLines}

--- ACADÊMICO: Notas na faculdade ---
${grades.length > 0 ? grades.map((g) => `  - ${g}`).join('\n') : '  (sem disciplinas ativas)'}

--- ACADÊMICO: Próximas avaliações ---
${examLines}

--- FÍSICO: Status TAF (Bombeiros SC) ---
${tafContext()}

--- FÍSICO: Histórico de treinos ---
${fitnessContext()}

REGRAS CRÍTICAS:
1. Use os horários disponíveis na rotina. startTime deve caber dentro de um bloco.
2. type deve ser: "study" (estudo novo), "review" (revisão), "train" (treino físico), "rest" (descanso/recuperação), "admin" (tarefas/finanças/organização), "other" (outros).
3. ADAPTAÇÃO AUTOMÁTICA: se houver prova em 1-3 dias, substitua treinos por revisão ("review") nessa matéria. Prova amanhã = revisão hoje obrigatória.
4. Intercale estudo com treino e descanso para evitar burnout.
5. Inclua sessões de treino físico baseadas no histórico e gaps do TAF.
6. Priorize déficits do TAF em sessões de treino (ex: se Cooper está abaixo do mínimo, agende corrida).
7. Nomes dos dias em inglês. startTime no formato "HH:MM".

Retorne APENAS array JSON sem markdown:
[{"day":"monday","startTime":"19:00","type":"study","topic":"...","durationMinutes":60,"priority":"high|medium|low","reason":"..."}]`;

  return parseSessionsFromAI(await aiClient.completeJson(prompt));
}
