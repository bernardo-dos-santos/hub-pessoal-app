/**
 * send-daily-push.js
 * Lê alertas críticos do banco e envia push notifications para os subscribers.
 * Agendar via Task Scheduler: todo dia às 07h00 (e opcionalmente às 20h para alerta de sessão).
 *
 * Alertas implementados:
 *  1. Prova na faculdade amanhã ou hoje
 *  2. Sem treino há 5 dias ou mais (só enquanto o hábito existe: último treino ≤ 21 dias)
 *  3–6 só se o plano semanal está sendo seguido (sessão marcada nos últimos 14 dias)
 *  3. Sessão de hoje não registrada (dispara se rodado às 20h+)
 *  4. Sequência em risco (quarta ou depois, zero conclusões na semana)
 *  5. Semana abaixo de 50% (quinta ou sexta)
 *  6. Prova em 3 dias sem revisão concluída
 *  7. Budget excedendo 90%
 *  8. Fatura do cartão vencendo em ≤2 dias
 *  9. Meta perto do prazo (≤5 dias, progresso < 70%)
 * 10. Energia baixa no check-in de hoje
 *
 * Uso:
 *   node scripts/schedule/send-daily-push.js
 */

import { createLogger } from '../lib/logger.js';
import { openHubDb, ownerKv } from '../lib/hubDb.js';
import { HUB_URL, waitForHub } from '../lib/hubApi.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import {
  clampStartDay,
  currentFinancialMonth,
  isInFinancialMonth,
  MONTH_START_DAY_KEY,
} from '../../src/shared/finance/financeMonth.js';
import { budgetLimitOf, budgetSpent } from '../../src/shared/finance/financeTotals.js';
import { isStudyPlanInUse, isTrainingInUse } from '../../src/shared/activity/recentActivity.js';
import { localDayKey } from '../../src/shared/dates/localDay.js';

const log = createLogger('send-daily-push');
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../../hub.db');

const WEEK_DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEK_DAY_IDX = Object.fromEntries(WEEK_DAY_NAMES.map((d, i) => [d, i]));

function buildNotifications() {
  if (!existsSync(DB_PATH)) return [];
  const db = openHubDb(DB_PATH);
  const kv = ownerKv(db);
  const notifications = [];
  const today = new Date();
  const todayStr = localDayKey(today);
  const todayDayName = WEEK_DAY_NAMES[today.getDay()];
  const todayDayIdx = today.getDay();

  // Dados compartilhados entre os alertas de estudo
  // Only nag about the plan while it's being followed (shared/activity/recentActivity.js).
  const completions = kv.get('study.sessionCompletions') ?? {};
  const plan = isStudyPlanInUse(completions, today) ? kv.get('planner.weeklyPlan') : null;

  // ── 1. Prova hoje ou amanhã ─────────────────────────────────────────────────
  const assessments = kv.get('college.assessments') ?? [];
  const subjects = kv.get('college.subjects') ?? [];
  const urgentAssessments = assessments.filter((a) => {
    if (a.status !== 'scheduled' || !a.date) return false;
    const daysUntil = Math.round((new Date(a.date).getTime() - today.getTime()) / 86400000);
    return daysUntil <= 1;
  });
  for (const a of urgentAssessments.slice(0, 2)) {
    const sub = subjects.find((s) => s.id === a.subjectId);
    const daysUntil = Math.round((new Date(a.date).getTime() - today.getTime()) / 86400000);
    notifications.push({
      title: daysUntil <= 0 ? '📚 Prova HOJE' : '📚 Prova amanhã',
      body: `${sub?.name ?? a.title}: ${a.title}`,
      url: '/faculdade',
    });
  }

  // ── 2. Sem treino há 5 dias ou mais ───────────────────────────────────────
  const workouts = kv.get('fitness.workouts') ?? [];
  if (workouts.length > 0) {
    const lastWorkout = new Date(workouts[0].date + 'T00:00:00');
    const daysSince = Math.floor((today.getTime() - lastWorkout.getTime()) / 86400000);
    if (daysSince >= 5 && isTrainingInUse(daysSince)) {
      notifications.push({
        title: '💪 Treino',
        body: `Último treino há ${daysSince} dias.`,
        url: '/treino',
      });
    }
  }

  // ── 3. Sessão de hoje não registrada (útil quando rodado às 20h) ───────────
  if (today.getHours() >= 20 && plan?.sessions?.length > 0) {
    const todaySessions = plan.sessions.map((s, i) => ({ s, i })).filter(({ s }) => s.day === todayDayName);
    const unmarked = todaySessions.filter(({ i }) => !completions[`${plan.weekOf}:${i}`]);
    if (unmarked.length > 0) {
      notifications.push({
        title: '📖 Sessões de hoje',
        body: `${unmarked.length} sessão(ões) do plano ainda sem marcação.`,
        url: '/estudos',
      });
    }
  }

  // ── 4. Sequência em risco (quarta ou depois, zero conclusões na semana) ────
  if (todayDayIdx >= 3 && plan?.sessions?.length > 0) {
    const doneThisWeek = Object.entries(completions).filter(
      ([k, v]) => k.startsWith(`${plan.weekOf}:`) && (v === 'done' || v === 'partial'),
    );
    if (doneThisWeek.length === 0) {
      notifications.push({
        title: '📖 Plano da semana',
        body: 'Nenhuma sessão marcada nesta semana ainda.',
        url: '/estudos',
      });
    }
  }

  // ── 5. Semana abaixo de 50% (quinta ou sexta) ──────────────────────────────
  if ((todayDayIdx === 4 || todayDayIdx === 5) && plan?.sessions?.length > 0) {
    const pastSessions = plan.sessions.map((s, i) => ({ s, i })).filter(({ s }) => (WEEK_DAY_IDX[s.day] ?? 0) < todayDayIdx);
    if (pastSessions.length > 0) {
      const done = pastSessions.filter(({ i }) => {
        const status = completions[`${plan.weekOf}:${i}`];
        return status === 'done' || status === 'partial';
      }).length;
      const rate = Math.round((done / pastSessions.length) * 100);
      if (rate < 50) {
        notifications.push({
          title: '📖 Plano da semana',
          body: `${rate}% das sessões até aqui foram feitas.`,
          url: '/estudos',
        });
      }
    }
  }

  // ── 6. Prova em 3 dias sem revisão concluída ───────────────────────────────
  const nearAssessments = assessments.filter((a) => {
    if (a.status !== 'scheduled' || !a.date) return false;
    const daysUntil = Math.round((new Date(a.date).getTime() - today.getTime()) / 86400000);
    return daysUntil > 1 && daysUntil <= 3;
  });
  if (nearAssessments.length > 0 && plan?.sessions?.length > 0) {
    const hasReview = plan.sessions.some((s, i) => {
      const status = completions[`${plan.weekOf}:${i}`];
      return s.type === 'review' && (status === 'done' || status === 'partial');
    });
    if (!hasReview) {
      const a = nearAssessments[0];
      const sub = subjects.find((s) => s.id === a.subjectId);
      const daysUntil = Math.round((new Date(a.date).getTime() - today.getTime()) / 86400000);
      notifications.push({
        title: '📝 Prova em breve sem revisão',
        body: `${sub?.name ?? a.title} em ${daysUntil} dia(s) — nenhuma revisão concluída essa semana.`,
        url: '/faculdade',
      });
    }
  }

  // ── 7. Budget excedendo 90% ───────────────────────────────────────────────
  const budgets = kv.get('finance.budgets') ?? [];
  const transactions = kv.get('finance.transactions') ?? [];
  if (budgets.length > 0 && transactions.length > 0) {
    const startDay = clampStartDay(kv.get(MONTH_START_DAY_KEY));
    const monthStr = currentFinancialMonth(startDay, today);
    const monthTxs = transactions.filter((t) => isInFinancialMonth(t.date, monthStr, startDay));
    for (const budget of budgets.filter((b) => b.isActive && budgetLimitOf(b) > 0)) {
      // Same number the Orçamentos screen shows (financeTotals.js): net of
      // refunds, without bill payments, transfers or matched reimbursements.
      const limit = budgetLimitOf(budget);
      const spent = budgetSpent(budget, monthTxs);
      const pct = (spent / limit) * 100;
      if (pct >= 90) {
        notifications.push({
          title: '💰 Budget quase esgotado',
          body: `${budget.name}: ${Math.round(pct)}% usado (R${spent.toFixed(0)} / R${limit.toFixed(0)})`,
          url: '/financeiro',
        });
        break; // um alerta de budget por vez
      }
    }
  }

  // ── 8. Fatura vencendo em ≤2 dias ────────────────────────────────────────
  const cards = kv.get('finance.cards') ?? [];
  for (const card of cards.filter((c) => c.isActive && c.dueDay)) {
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueIn = (year, month) => new Date(year, month, Math.min(card.dueDay, new Date(year, month + 1, 0).getDate()));
    let dueDate = dueIn(midnight.getFullYear(), midnight.getMonth());
    if (dueDate < midnight) dueDate = dueIn(midnight.getFullYear(), midnight.getMonth() + 1);
    const daysUntilDue = Math.round((dueDate.getTime() - midnight.getTime()) / 86400000);
    if (daysUntilDue >= 0 && daysUntilDue <= 2) {
      notifications.push({
        title: '💳 Fatura vencendo',
        body: `${card.name}: vence ${daysUntilDue === 0 ? 'hoje' : `em ${daysUntilDue} dia(s)`}`,
        url: '/financeiro',
      });
    }
  }

  // ── 9. Meta perto do prazo (≤5 dias, progresso < 70%) ────────────────────
  const goals = kv.get('goals.list') ?? [];
  // Local calendar days: `new Date('YYYY-MM-DD')` is UTC midnight, 21h the day before here.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const daysUntilGoal = (g) =>
    Math.round((new Date(g.targetDate.slice(0, 10) + 'T00:00:00').getTime() - midnight.getTime()) / 86400000);
  const urgentGoals = goals.filter((g) => {
    if (g.status !== 'active' || !g.targetDate) return false;
    const daysUntil = daysUntilGoal(g);
    if (daysUntil < 0 || daysUntil > 5) return false;
    const total = g.keyResults?.length ?? 0;
    const done = (g.keyResults ?? []).filter((kr) => kr.status === 'done').length;
    const progress = total > 0 ? (done / total) * 100 : 0;
    return progress < 70;
  });
  if (urgentGoals.length > 0) {
    const g = urgentGoals[0];
    const daysUntil = daysUntilGoal(g);
    notifications.push({
      title: '🎯 Meta perto do prazo',
      body: `"${g.title}" vence ${daysUntil === 0 ? 'hoje' : `em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}`} com progresso abaixo de 70%.`,
      url: '/metas',
    });
  }

  // ── 10. Energia baixa no check-in de hoje ──────────────────────────────────
  const jarvisCheckIns = kv.get('jarvis.checkIns') ?? {};
  const todayCheckIn = jarvisCheckIns[todayStr];
  if (todayCheckIn && todayCheckIn.mood > 0 && todayCheckIn.energy <= 2) {
    notifications.push({
      title: '🔋 Energia baixa hoje',
      body: 'Seu check-in indica energia baixa. Considere uma sessão mais curta ou de revisão.',
      url: '/estudos',
    });
  }

  db.close();
  return notifications;
}

async function main() {
  log.info('Verificando alertas para envio de push...');

  const notifications = buildNotifications();

  if (notifications.length === 0) {
    log.success('Nenhum alerta crítico hoje — push não enviado.');
    return;
  }

  log.info(`${notifications.length} alerta(s) — vão num push só.`);
  try {
    await waitForHub({ log });
  } catch (err) {
    log.error('Push não enviado', err);
    process.exitCode = 1;
    return;
  }

  // One push per run, not one per alert: this runs twice a day and each alert
  // used to be its own push, which on a bad day meant a burst of five at 7h
  // on top of the Íris's own. The Home's "Atenção" card has the details.
  const outgoing = notifications.length === 1 ? notifications : [{
    title: `${notifications.length} lembretes para hoje`,
    body: notifications.map((n) => n.title).join(' · ').slice(0, 180),
    url: '/',
  }];

  for (const notif of outgoing) {
    try {
      const res = await fetch(`${HUB_URL}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notif),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        log.success(`Push enviado: "${notif.title}" → ${data.sent} subscriber(s)`);
      } else {
        log.error(`Falha ao enviar "${notif.title}": ${data.error ?? `HTTP ${res.status}`}`);
      }
    } catch (err) {
      log.error(`Erro ao enviar "${notif.title}"`, err);
    }
  }
}

main().catch((err) => {
  log.error('Erro inesperado', err);
  process.exit(1);
});
