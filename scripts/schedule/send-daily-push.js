/**
 * send-daily-push.js
 * Lê alertas críticos do banco e envia push notifications para os subscribers.
 * Agendar via Task Scheduler: todo dia às 07h00 (e opcionalmente às 20h para alerta de sessão).
 *
 * Alertas implementados:
 *  1. Edital do CBMSC detectado
 *  2. Edital da ABIN detectado
 *  3. Prova na faculdade amanhã ou hoje
 *  4. TAF: item abaixo do mínimo sem treino há mais de 5 dias
 *  5. Check-in ABIN todo domingo
 *  6. Sessão de hoje não registrada (dispara se rodado às 20h+)
 *  7. Sequência em risco (quarta ou depois, zero conclusões na semana)
 *  8. Semana abaixo de 50% (quinta ou sexta)
 *  9. Prova em 3 dias sem revisão concluída
 * 10. Budget excedendo 90%
 * 11. Fatura do cartão vencendo em ≤2 dias
 * 12. Meta perto do prazo (≤5 dias, progresso < 70%)
 * 13. Energia baixa no check-in de hoje
 *
 * Uso:
 *   node scripts/schedule/send-daily-push.js
 */

import { createLogger } from '../lib/logger.js';
import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const log = createLogger('send-daily-push');
const __dirname = dirname(fileURLToPath(import.meta.url));
const HUB_URL = process.env.HUB_BACKEND ?? 'http://localhost:3001';
const DB_PATH = resolve(__dirname, '../../hub.db');
const ABIN_ALERTS_PATH = resolve(__dirname, '../../public/abin-alerts.json');

const WEEK_DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEK_DAY_IDX = Object.fromEntries(WEEK_DAY_NAMES.map((d, i) => [d, i]));

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function getMondayIso(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getKey(db, key) {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  return row ? safeJson(row.value) : null;
}

function buildNotifications() {
  if (!existsSync(DB_PATH)) return [];
  const db = new DatabaseSync(DB_PATH);
  const notifications = [];
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDayName = WEEK_DAY_NAMES[today.getDay()];
  const todayDayIdx = today.getDay();

  // Dados compartilhados entre os alertas de estudo
  const plan = getKey(db, 'study.weeklyPlan');
  const completions = getKey(db, 'study.sessionCompletions') ?? {};

  // ── 1. Edital CBMSC ────────────────────────────────────────────────────────
  const editalCache = getKey(db, 'concurso.editalAlertsCache');
  if (editalCache?.alerts?.length > 0) {
    const dismissed = getKey(db, 'concurso.dismissedEditalAlerts') ?? [];
    const active = editalCache.alerts.filter((a) => !dismissed.includes(a.detectedAt + a.url));
    if (active.length > 0) {
      notifications.push({ title: '🚨 Alerta CBMSC', body: active[0].title, url: '/concurso' });
    }
  }

  // ── 2. Edital ABIN ─────────────────────────────────────────────────────────
  if (existsSync(ABIN_ALERTS_PATH)) {
    try {
      const abinData = JSON.parse(readFileSync(ABIN_ALERTS_PATH, 'utf-8'));
      if (abinData?.alerts?.length > 0) {
        const dismissedAbin = getKey(db, 'concurso.abin.dismissedAlerts') ?? [];
        const active = abinData.alerts.filter(
          (a) => !dismissedAbin.includes(a.detectedAt + a.url),
        );
        if (active.length > 0) {
          notifications.push({ title: '🕵️ Alerta ABIN', body: active[0].title, url: '/abin' });
        }
      }
    } catch { /* arquivo malformado — ignora */ }
  }

  // ── 3. Prova hoje ou amanhã ─────────────────────────────────────────────────
  const assessments = getKey(db, 'college.assessments') ?? [];
  const subjects = getKey(db, 'college.subjects') ?? [];
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

  // ── 4. TAF: sem treino há mais de 5 dias ───────────────────────────────────
  const workouts = getKey(db, 'fitness.workouts') ?? [];
  if (workouts.length > 0) {
    const lastWorkout = new Date(workouts[0].date + 'T00:00:00');
    const daysSince = Math.floor((today.getTime() - lastWorkout.getTime()) / 86400000);
    if (daysSince >= 5) {
      notifications.push({
        title: '💪 Treino em atraso',
        body: `Você não treina há ${daysSince} dias. TAF do CBMSC não espera!`,
        url: '/treino',
      });
    }
  }

  // ── 5. Check-in ABIN todo domingo ──────────────────────────────────────────
  if (todayDayIdx === 0) {
    const abinCheckIns = getKey(db, 'concurso.abin.checkIns') ?? [];
    const monday = getMondayIso(today);
    const thisWeekDone = abinCheckIns.some((ci) => ci.weekStart === monday);
    if (!thisWeekDone) {
      notifications.push({
        title: '🕵️ Check-in ABIN',
        body: 'Registre as horas de estudo e treino desta semana.',
        url: '/abin',
      });
    }
  }

  // ── 6. Sessão de hoje não registrada (útil quando rodado às 20h) ───────────
  if (today.getHours() >= 20 && plan?.sessions?.length > 0) {
    const todaySessions = plan.sessions.map((s, i) => ({ s, i })).filter(({ s }) => s.day === todayDayName);
    const unmarked = todaySessions.filter(({ i }) => !completions[`${plan.weekOf}:${i}`]);
    if (unmarked.length > 0) {
      notifications.push({
        title: '📖 Sessão não registrada',
        body: `${unmarked.length} sessão(ões) de hoje sem status. Você estudou?`,
        url: '/estudos',
      });
    }
  }

  // ── 7. Sequência em risco (quarta ou depois, zero conclusões na semana) ────
  if (todayDayIdx >= 3 && plan?.sessions?.length > 0) {
    const doneThisWeek = Object.entries(completions).filter(
      ([k, v]) => k.startsWith(`${plan.weekOf}:`) && (v === 'done' || v === 'partial'),
    );
    if (doneThisWeek.length === 0) {
      notifications.push({
        title: '⚠️ Sequência em risco',
        body: 'Nenhuma sessão registrada essa semana. Não deixa a sequência quebrar!',
        url: '/estudos',
      });
    }
  }

  // ── 8. Semana abaixo de 50% (quinta ou sexta) ──────────────────────────────
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
          title: '📉 Semana abaixo de 50%',
          body: `Taxa de conclusão: ${rate}%. Ainda dá pra recuperar hoje!`,
          url: '/estudos',
        });
      }
    }
  }

  // ── 9. Prova em 3 dias sem revisão concluída ───────────────────────────────
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

  // ── 10. Budget excedendo 90% ───────────────────────────────────────────────
  const budgets = getKey(db, 'finance.budgets') ?? [];
  const transactions = getKey(db, 'finance.transactions') ?? [];
  if (budgets.length > 0 && transactions.length > 0) {
    const monthStr = todayStr.slice(0, 7);
    const monthExpenses = transactions.filter((t) => t.date?.startsWith(monthStr) && t.amount < 0);
    for (const budget of budgets.filter((b) => b.isActive && b.limit > 0)) {
      const budgetCatId = (budget.categoryId ?? '').toLowerCase();
      const budgetCatName = (budget.category ?? budget.name ?? '').toLowerCase();
      const spent = monthExpenses
        .filter((t) => {
          const tCatId = (t.categoryId ?? '').toLowerCase();
          const tCat = (t.category ?? '').toLowerCase();
          return (budgetCatId && tCatId === budgetCatId) || tCat === budgetCatName;
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const pct = (spent / budget.limit) * 100;
      if (pct >= 90) {
        notifications.push({
          title: '💰 Budget quase esgotado',
          body: `${budget.name}: ${Math.round(pct)}% usado (R$${spent.toFixed(0)} / R$${budget.limit.toFixed(0)})`,
          url: '/financeiro',
        });
        break; // um alerta de budget por vez
      }
    }
  }

  // ── 11. Fatura vencendo em ≤2 dias ────────────────────────────────────────
  const cards = getKey(db, 'finance.cards') ?? [];
  for (const card of cards.filter((c) => c.isActive && c.dueDay)) {
    const dueDate = new Date(today.getFullYear(), today.getMonth(), card.dueDay);
    if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);
    const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    if (daysUntilDue >= 0 && daysUntilDue <= 2) {
      notifications.push({
        title: '💳 Fatura vencendo',
        body: `${card.name}: vence ${daysUntilDue === 0 ? 'hoje' : `em ${daysUntilDue} dia(s)`}`,
        url: '/financeiro',
      });
    }
  }

  // ── 12. Meta perto do prazo (≤5 dias, progresso < 70%) ────────────────────
  const goals = getKey(db, 'goals.list') ?? [];
  const urgentGoals = goals.filter((g) => {
    if (g.status !== 'active' || !g.targetDate) return false;
    const daysUntil = Math.round((new Date(g.targetDate).getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > 5) return false;
    const total = g.keyResults?.length ?? 0;
    const done = (g.keyResults ?? []).filter((kr) => kr.status === 'done').length;
    const progress = total > 0 ? (done / total) * 100 : 0;
    return progress < 70;
  });
  if (urgentGoals.length > 0) {
    const g = urgentGoals[0];
    const daysUntil = Math.round((new Date(g.targetDate).getTime() - today.getTime()) / 86400000);
    notifications.push({
      title: '🎯 Meta perto do prazo',
      body: `"${g.title}" vence em ${daysUntil} dia(s) com progresso abaixo de 70%.`,
      url: '/metas',
    });
  }

  // ── 13. Energia baixa no check-in de hoje ──────────────────────────────────
  const jarvisCheckIns = getKey(db, 'jarvis.checkIns') ?? {};
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
    log.info('Nenhum alerta crítico hoje — push não enviado.');
    return;
  }

  log.info(`${notifications.length} notificação(ões) para enviar.`);

  for (const notif of notifications) {
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
