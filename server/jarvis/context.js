/**
 * jarvis/context.js — helpers + context builder, moved verbatim from jarvis.js.
 */

import { kvStore } from '../db.js';
import { getCachedBriefing } from '../briefing.js';
// Ciclo com location.js (ele importa `kv` daqui), seguro pelo mesmo motivo do
// ciclo documentado em tools/index.js: os dois lados só se usam dentro de corpo
// de função, nunca na avaliação do módulo.
import { getLocationContext } from './location.js';
import { getJarvisConfig } from './config.js';
import { PROFILE_PATH, readProfile } from './memoryStore.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function kv(key) {
  const raw = kvStore.get(key);
  return raw ? safeJson(raw) : null;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function weekDayStr() {
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return days[new Date().getDay()];
}

export function todayWeekDay() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

/**
 * Acha a disciplina por nome parcial — Bernardo fala "cálculo", não o nome completo
 * cadastrado no SIGAA. Também olha os aliases, que existem exatamente pra isso.
 */
export function findSubject(subjects, name) {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return subjects.find((s) => s.name?.toLowerCase().includes(needle))
    ?? subjects.find((s) => (s.aliases ?? []).some((a) => a?.toLowerCase().includes(needle)))
    ?? null;
}

/** Dias inteiros de `from` até `to` (ambos YYYY-MM-DD). Negativo = já passou. */
export function daysBetween(from, to) {
  if (!to) return null;
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Um orçamento cobre a categoria buscada? Considera o campo único e a lista. */
export function matchesCategory(budget, category) {
  const needle = category.trim().toLowerCase();
  const cats = budget.categories?.length ? budget.categories : [budget.category];
  return cats.filter(Boolean).some((c) => c.toLowerCase().includes(needle));
}

// ── Context builder ───────────────────────────────────────────────────────────

export function buildContext() {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const transactions = kv('finance.transactions') ?? [];
  const monthTxs = transactions.filter((t) => t.date?.startsWith(currentMonth));
  const income = monthTxs.filter((t) => t.kind === 'income').reduce((s, t) => s + (t.amount ?? 0), 0);
  const expenses = monthTxs
    .filter((t) => ['expense', 'card_purchase'].includes(t.kind))
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
  const pendingReview = monthTxs.filter((t) => t.needsReview).length;

  const plan = kv('planner.weeklyPlan');
  const todayDaySessions = plan?.sessions?.filter((s) => s.day === todayWeekDay()) ?? [];
  const completions = kv('study.sessionCompletions') ?? {};
  const weekOf = plan?.weekOf ?? '';
  const completedToday = todayDaySessions.filter((_, idx) => {
    const globalIdx = plan?.sessions?.findIndex(
      (s) => s.day === todayWeekDay() && s === todayDaySessions[idx],
    );
    return globalIdx >= 0 && completions[`${weekOf}:${globalIdx}`] === 'done';
  }).length;

  const checkIns = kv('jarvis.checkIns') ?? {};
  const todayCheckIn = checkIns[todayStr()] ?? null;

  const activityLog = kv('study.activityLog') ?? [];
  const streakDays = (() => {
    const sorted = [...activityLog].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    let expected = todayStr();
    for (const entry of sorted) {
      const d = new Date(expected + 'T12:00:00');
      if (entry.date === expected) {
        streak++;
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else if (entry.date < expected) break;
    }
    return streak;
  })();

  // Exclusivo (não inclusivo): tira só matéria arquivada da faculdade das
  // contagens abaixo. O módulo Estudos também usa subjectTag pra tópico de
  // concurso sem registro em college.subjects — um filtro por inclusão
  // apagaria esse conteúdo inteiro do contexto do Jarvis (mesma razão do
  // subjectService.listArchivedSubjectTags() no frontend, duplicado aqui
  // porque o servidor é JS puro e não importa TS do frontend).
  const subjects = kv('college.subjects') ?? [];
  const archivedSubjectTags = new Set(
    subjects.filter((s) => s.status !== 'active').flatMap((s) => [s.name, ...(s.aliases ?? [])]),
  );

  const questions = kv('study.questions') ?? [];
  const questionSubjectTagById = new Map(questions.map((q) => [q.id, q.subjectTag]));

  const questStates = kv('study.questStates') ?? {};
  const dueCards = Object.values(questStates).filter((s) => {
    const tag = questionSubjectTagById.get(s.questionId);
    if (tag && archivedSubjectTags.has(tag)) return false;
    if (!s.nextReviewAt) return true;
    return new Date(s.nextReviewAt) <= new Date();
  }).length;

  const errorNotebook = kv('study.errorNotebook') ?? [];
  const pendingErrors = Array.isArray(errorNotebook)
    ? errorNotebook.filter((e) => !e.resolved && !archivedSubjectTags.has(e.subjectTag)).length
    : 0;

  const assessments = kv('college.assessments') ?? [];
  const upcoming = assessments
    .filter((a) => a.status === 'scheduled' && a.date >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((a) => {
      const sub = subjects.find((s) => s.id === a.subjectId);
      const daysUntil = Math.round(
        (new Date(a.date + 'T12:00:00').getTime() - today.getTime()) / 86400000,
      );
      return `${sub?.name ?? a.subjectId}: ${a.title} ${daysUntil === 0 ? '(HOJE)' : daysUntil === 1 ? '(amanhã)' : `(em ${daysUntil} dias)`}`;
    });

  const goals = (kv('goals.list') ?? []).filter((g) => g.status === 'active');

  const workouts = kv('fitness.workouts') ?? [];
  const lastWorkout = workouts[0];
  const daysSinceWorkout = lastWorkout
    ? Math.floor((today.getTime() - new Date(lastWorkout.date + 'T00:00:00').getTime()) / 86400000)
    : null;

  const ACTIVITY_LABELS_JS = { free: 'Livre', study: 'Estudo', college: 'Faculdade', gym: 'Treino', work: 'Trabalho', meal: 'Refeição', commute: 'Deslocamento', rest: 'Descanso', personal: 'Pessoal' };
  const routine = kv('planner.routine');
  const todayRoutine = routine?.days?.find((d) => d.day === todayWeekDay()) ?? null;
  const todaySchedule = todayRoutine?.blocks?.length > 0
    ? todayRoutine.blocks.map((b) => `${b.start}–${b.end} ${ACTIVITY_LABELS_JS[b.activity ?? 'free'] ?? 'Livre'}`).join(', ')
    : null;

  const examDate = kv('concurso.examDate');
  const daysUntilExam = examDate
    ? Math.ceil((new Date(examDate).getTime() - today.getTime()) / 86400000)
    : null;

  // Resumo financeiro do mês anterior
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const monthlySummary = kv(`finance.monthly-summary.${prevMonth}`);

  const completionCount = plan
    ? Object.entries(completions)
        .filter(([k, v]) => k.startsWith(`${weekOf}:`) && (v === 'done' || v === 'partial'))
        .length
    : 0;
  const totalSessions = plan?.sessions?.length ?? 0;
  const weekCompletionRate = totalSessions > 0
    ? Math.round((completionCount / totalSessions) * 100)
    : null;

  // Índices das sessões de hoje no plano global (para a tool mark_study_session_done)
  const todaySessionIndices = todayDaySessions.map((s) =>
    plan?.sessions?.findIndex((ps) => ps === s) ?? -1,
  );

  const frontendCtxRaw = kv('hub.context.daily');
  const frontendCtx = frontendCtxRaw?.date === todayStr() ? frontendCtxRaw : null;

  // Só o resumo sempre-carregado entra no prompt. O resto da memória vive em
  // arquivos que o modelo abre com a ferramenta `memory` quando precisa — foi
  // o que tirou o teto de 60 fatos (ver ./memoryStore.js).
  const memoryEnabled = getJarvisConfig().capabilities.memoryTool === true;
  const memoryProfile = memoryEnabled ? readProfile() : null;

  const investments = kv('finance.investments') ?? [];
  const investmentGoal = kv('finance.investments.monthlyGoal');
  const invSummary = {
    count: investments.length,
    invested: investments.reduce((s, i) => s + (i.totalInvested ?? 0), 0),
    patrimony: investments.reduce((s, i) => s + (i.currentValue ?? 0), 0),
    // Reserva e carteira são coisas separadas — juntar os dois no resumo faria
    // parecer que a reserva de emergência é "carteira sobrando".
    reserve: investments.filter((i) => (i.bucket ?? 'carteira') === 'reserva').reduce((s, i) => s + (i.currentValue ?? 0), 0),
    portfolio: investments.filter((i) => (i.bucket ?? 'carteira') === 'carteira').reduce((s, i) => s + (i.currentValue ?? 0), 0),
    monthlyGoal: investmentGoal?.targetAmount ?? null,
  };

  const rpgChar = kv('rpg.activeCharacter');
  const rpg = rpgChar
    ? {
        name: rpgChar.name,
        campaign: rpgChar.campaign ?? null,
        attributes: (rpgChar.attributes ?? []).map((a) => `${a.label} ${a.value}`).join(', '),
      }
    : null;

  const dismissedAlerts = kv('concurso.dismissedEditalAlerts') ?? [];
  const editalAlerts = (kv('concurso.editalAlertsCache')?.alerts ?? [])
    .filter((a) => !dismissedAlerts.includes(a.detectedAt + a.url));

  const timeStr = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Nome de lugar e "há quanto tempo" viajam separados de propósito: o nome é
  // estável e entra no hash do tick (trocar de lugar VIRA gatilho); o tempo
  // muda a cada leitura e é descartado do hash (ver contextFingerprint).
  const locationCtx = getLocationContext();

  return {
    memoryEnabled,
    memoryProfile,
    timeStr,
    location: locationCtx.place ? { place: locationCtx.place } : null,
    locationAt: locationCtx.at,
    locationAtLabel: locationCtx.minutesAgo === undefined
      ? null
      : locationCtx.minutesAgo < 1 ? 'agora' : `há ${locationCtx.minutesAgo} min`,
    investments: invSummary,
    rpg,
    editalAlerts,
    todayStr: todayStr(),
    weekDay: weekDayStr(),
    weekOf,
    finance: { income, expenses, balance: income - expenses, pendingReview },
    checkIn: todayCheckIn,
    streakDays,
    dueCards,
    pendingErrors,
    todaySessions: todayDaySessions,
    todaySessionIndices,
    completedToday,
    upcoming,
    goals: goals.slice(0, 5).map((g) => ({ id: g.id, title: g.title, progress: g.progress ?? 0 })),
    fitness: { daysSinceWorkout, lastType: lastWorkout?.type ?? null },
    daysUntilExam,
    weekCompletionRate,
    todaySchedule,
    frontendCtx,
    monthlySummary,
    prevMonth,
  };
}

export function buildContextPrompt(ctx) {
  const briefing = getCachedBriefing();
  const checkInLine = ctx.checkIn && ctx.checkIn.mood > 0
    ? `Check-in: humor ${ctx.checkIn.mood}/5, energia ${ctx.checkIn.energy}/5, sono ${ctx.checkIn.hoursSlept}h`
    : 'Check-in: não preenchido hoje';

  const sessionsLine = ctx.todaySessions.length > 0
    ? ctx.todaySessions
        .map((s, i) => `[idx ${ctx.todaySessionIndices[i]}] ${s.startTime} ${s.topic}`)
        .join(', ')
    : 'nenhuma planejada';

  return `CONTEXTO ATUAL — ${ctx.weekDay}, ${ctx.todayStr}, ${ctx.timeStr} (leve a hora do dia em conta: a resposta certa às 8h raramente é a mesma das 23h):

FINANCEIRO: receita R$${ctx.finance.income.toFixed(0)}, gastos R$${ctx.finance.expenses.toFixed(0)}, saldo R$${ctx.finance.balance.toFixed(0)}${ctx.finance.pendingReview > 0 ? `, ${ctx.finance.pendingReview} transações para revisar` : ''}

ESTUDO: streak ${ctx.streakDays} dias, ${ctx.dueCards} SM-2 vencidos, ${ctx.pendingErrors} erros pendentes${ctx.weekCompletionRate !== null ? `, conclusão semanal ${ctx.weekCompletionRate}%` : ''}

SESSÕES HOJE (índice global no plano): ${sessionsLine} (${ctx.completedToday} de ${ctx.todaySessions.length} concluídas)

${checkInLine}

${ctx.todaySchedule ? `AGENDA DE HOJE: ${ctx.todaySchedule}` : ''}

${ctx.location ? `ONDE ELE ESTÁ: ${ctx.location.place}${ctx.locationAt ? ` (posição de ${ctx.locationAtLabel})` : ''}. Use como pano de fundo, não como assunto — comentar a localização sem propósito é assustador, não útil.` : ''}

FITNESS: ${ctx.fitness.daysSinceWorkout === null ? 'sem treinos registrados' : ctx.fitness.daysSinceWorkout === 0 ? 'treinou hoje' : `último treino há ${ctx.fitness.daysSinceWorkout} dias`}

FACULDADE: ${ctx.upcoming.length > 0 ? ctx.upcoming.join('; ') : 'sem provas próximas'}

METAS ATIVAS: ${ctx.goals.length > 0 ? ctx.goals.map((g) => `"${g.title}" (${g.progress}%)`).join(', ') : 'nenhuma'}

${ctx.daysUntilExam !== null ? `CONCURSO: ${ctx.daysUntilExam} dias para a prova` : ''}

${ctx.monthlySummary ? `RESUMO FINANCEIRO DE ${ctx.prevMonth}: receita R$${ctx.monthlySummary.income.toFixed(0)}, gastos R$${ctx.monthlySummary.totalOutflow.toFixed(0)}, saldo R$${ctx.monthlySummary.balance.toFixed(0)}, poupança ${ctx.monthlySummary.savingsRate.toFixed(1)}%. ${ctx.monthlySummary.diagnosis}` : ''}

INVESTIMENTOS: ${ctx.investments.count > 0 ? `${ctx.investments.count} posições, R$${ctx.investments.invested.toFixed(0)} investidos, patrimônio R$${ctx.investments.patrimony.toFixed(0)} (reserva R$${ctx.investments.reserve.toFixed(0)}, carteira R$${ctx.investments.portfolio.toFixed(0)})${ctx.investments.monthlyGoal ? `, meta de aporte R$${ctx.investments.monthlyGoal.toFixed(0)}/mês` : ''}` : 'nenhum registrado ainda'}

${ctx.rpg ? `RPG DE MESA (personagem dele): ${ctx.rpg.name}${ctx.rpg.campaign ? `, campanha "${ctx.rpg.campaign}"` : ''} — ${ctx.rpg.attributes}` : ''}

${ctx.editalAlerts.length > 0 ? `ALERTAS DE CONCURSO (não vistos — mencione se relevante): ${ctx.editalAlerts.map((a) => `${a.title} (${String(a.detectedAt).slice(0, 10)})`).join('; ')}` : ''}

${briefing?.text ? `BRIEFING DE HOJE: "${briefing.text}"` : ''}

${ctx.memoryEnabled ? `MEMÓRIA DE LONGO PRAZO — você tem um diretório de arquivos em /memories, que abre e edita com a ferramenta "memory". Como usar aqui:
- ${PROFILE_PATH} é o resumo do Senhor e já vem carregado abaixo: mantenha-o curto e atual. É o único arquivo que a verificação automática enxerga, então o que precisa estar sempre à mão vai nele
- Fato duradouro novo (preferência, hábito, promessa, decisão, contexto pessoal): grave sem alarde, mas sempre respondendo algo. Trivialidade do momento e dado que já tem ferramenta própria (transação, treino, prova, check-in) NÃO vão para a memória
- Cobre promessas registradas quando fizer sentido, com a data
- Assunto que rende muito texto (um projeto, uma matéria, um plano) merece arquivo próprio em /memories — o perfil fica para o que é sempre relevante
${ctx.memoryProfile ? `\nPERFIL REGISTRADO (${PROFILE_PATH}):\n${ctx.memoryProfile}` : `\nO perfil ainda está vazio — crie ${PROFILE_PATH} quando aparecer o primeiro fato que valha guardar.`}` : ''}

${ctx.frontendCtx ? `ESTADO REGISTRADO PELO APP: fitness ${ctx.frontendCtx.fitness?.workedOutToday ? `treino feito (${ctx.frontendCtx.fitness.todayWorkoutType})` : 'sem treino hoje'}, estudo ${ctx.frontendCtx.study?.sessionsCompletedToday ?? 0}/${ctx.frontendCtx.study?.sessionsTotalToday ?? 0} sessões, metas ativas ${ctx.frontendCtx.goals?.activeCount ?? 0}, check-in ${ctx.frontendCtx.checkIn?.done ? `registrado (humor ${ctx.frontendCtx.checkIn.mood}/5, energia ${ctx.frontendCtx.checkIn.energy}/5)` : 'pendente'}` : ''}`;
}
