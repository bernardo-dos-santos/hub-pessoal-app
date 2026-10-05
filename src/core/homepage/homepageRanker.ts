// Função pura (sem React) que lê o DailyContext e serviços para calcular
// os itens das 3 zonas da homepage. Sem side effects.

import { getDailyContext } from '../context/dailyContext';
import { invoiceService } from '../../modules/finance/services/invoiceService';
import { financeSummaryService } from '../../modules/finance/services/financeSummaryService';
import type { HomepageItem, RankedItems } from './homepageTypes';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86_400_000);
}

function pluralPt(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

function fmtBRL(n: number): string {
  const abs = Math.abs(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return n < 0 ? `-R$ ${abs}` : `R$ ${abs}`;
}

export function getRankedItems(): RankedItems {
  const ctx = getDailyContext();
  const now: HomepageItem[] = [];
  const progress: HomepageItem[] = [];
  const next: HomepageItem[] = [];

  // ── College ─────────────────────────────────────────────────────────────────
  if (ctx.college.nextExam) {
    const { name, daysLeft } = ctx.college.nextExam;
    if (daysLeft <= 1) {
      now.push({
        id: 'college-exam-urgent',
        module: 'college',
        score: 95,
        zone: 'now',
        title: `Prova ${daysLeft <= 0 ? 'hoje' : 'amanhã'}`,
        subtitle: name,
        badgeColor: 'red',
        route: '/faculdade',
      });
    } else if (daysLeft <= 3) {
      now.push({
        id: 'college-exam-near',
        module: 'college',
        score: 75,
        zone: 'now',
        title: `Prova em ${daysLeft} dias`,
        subtitle: name,
        badgeColor: 'red',
        route: '/faculdade',
      });
    } else if (daysLeft <= 7) {
      progress.push({
        id: 'college-exam-week',
        module: 'college',
        score: 55,
        zone: 'progress',
        title: `Prova em ${daysLeft} dias`,
        subtitle: name,
        badgeColor: 'yellow',
        route: '/faculdade',
      });
    } else {
      next.push({
        id: 'college-exam-next',
        module: 'college',
        score: 0,
        zone: 'next',
        title: 'Próxima prova',
        subtitle: `${name} · ${daysLeft} dias`,
        badgeColor: 'muted',
        route: '/faculdade',
      });
    }
  }

  if (ctx.college.urgentTasks > 0) {
    now.push({
      id: 'college-tasks',
      module: 'college',
      score: 75,
      zone: 'now',
      title: `${ctx.college.urgentTasks} ${pluralPt(ctx.college.urgentTasks, 'entrega urgente', 'entregas urgentes')}`,
      subtitle: 'Vence em até 3 dias',
      badge: String(ctx.college.urgentTasks),
      badgeColor: 'red',
      route: '/faculdade',
    });
  }

  // ── Finance — faturas críticas (≤ 2 dias) ──────────────────────────────────
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 2);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const critical = invoiceService
      .listInvoices()
      .filter((inv) => inv.dueDate && inv.dueDate >= todayStr && inv.dueDate <= cutoffStr && inv.status !== 'paid');

    if (critical.length > 0) {
      const inv = critical[0];
      const d = daysUntil(inv.dueDate!);
      const when = d <= 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;
      now.push({
        id: 'finance-invoice-critical',
        module: 'finance',
        score: 90,
        zone: 'now',
        title: `Fatura vence ${when}`,
        subtitle: fmtBRL(inv.total),
        badgeColor: 'red',
        route: '/financeiro/cartoes',
      });
    }
  } catch {
    // invoiceService pode não estar disponível antes do bootstrap
  }

  // ── Finance — saldo baixo ───────────────────────────────────────────────────
  try {
    const summary = financeSummaryService.getFinanceSummary();
    const isLow = summary.income > 0 && ctx.finance.monthBalance < summary.income * 0.10;

    if (isLow) {
      now.push({
        id: 'finance-low-balance',
        module: 'finance',
        score: 80,
        zone: 'now',
        title: 'Saldo mensal baixo',
        subtitle: `${fmtBRL(ctx.finance.monthBalance)} disponível`,
        badgeColor: 'red',
        route: '/financeiro',
      });
    } else if (summary.income > 0) {
      progress.push({
        id: 'finance-balance',
        module: 'finance',
        score: 10,
        zone: 'progress',
        title: 'Saldo do mês',
        subtitle: fmtBRL(ctx.finance.monthBalance),
        badgeColor: ctx.finance.monthBalance >= 0 ? 'green' : 'red',
        route: '/financeiro',
      });
    }
  } catch {
    // financeSummaryService pode falhar antes do bootstrap
  }

  // ── Finance — orçamentos excedidos ─────────────────────────────────────────
  if (ctx.finance.budgetsExceeded > 0) {
    now.push({
      id: 'finance-budget-exceeded',
      module: 'finance',
      score: 72,
      zone: 'now',
      title: `${ctx.finance.budgetsExceeded} ${pluralPt(ctx.finance.budgetsExceeded, 'orçamento excedido', 'orçamentos excedidos')}`,
      subtitle: 'Limite ultrapassado',
      badge: String(ctx.finance.budgetsExceeded),
      badgeColor: 'red',
      route: '/financeiro/orcamentos',
    });
  }

  // ── Finance — resumo mensal disponível ────────────────────────────────────
  if (ctx.finance.monthlyReportMonth) {
    const [yr, mo] = ctx.finance.monthlyReportMonth.split('-');
    const monthName = new Date(`${yr}-${mo}-15`).toLocaleDateString('pt-BR', { month: 'long' });
    progress.push({
      id: 'finance-monthly-report',
      module: 'finance',
      score: 60,
      zone: 'progress',
      title: `Resumo de ${monthName} disponível`,
      subtitle: 'Análise mensal com IA',
      badge: 'Novo',
      badgeColor: 'blue',
      route: `/financeiro/resumo/${ctx.finance.monthlyReportMonth}`,
    });
  }

  // ── Finance — revisão pendente ─────────────────────────────────────────────
  if (ctx.finance.pendingReview > 0) {
    progress.push({
      id: 'finance-pending',
      module: 'finance',
      score: 30,
      zone: 'progress',
      title: `${ctx.finance.pendingReview} ${pluralPt(ctx.finance.pendingReview, 'transação para revisar', 'transações para revisar')}`,
      subtitle: 'Importadas automaticamente',
      badge: String(ctx.finance.pendingReview),
      badgeColor: 'yellow',
      route: '/financeiro/revisao',
    });
  }

  // ── Study ───────────────────────────────────────────────────────────────────
  const due = ctx.study.dueCards + ctx.study.dueQuestions;

  if (due > 20) {
    now.push({
      id: 'study-due-critical',
      module: 'study',
      score: 80,
      zone: 'now',
      title: `${due} SM-2 vencidas`,
      subtitle: 'Revisão crítica',
      badge: String(due),
      badgeColor: 'red',
      route: '/estudos/questoes/praticar',
    });
  } else if (due >= 5) {
    progress.push({
      id: 'study-due',
      module: 'study',
      score: 55,
      zone: 'progress',
      title: `${due} revisões pendentes`,
      subtitle: 'SM-2 vencidas',
      badge: String(due),
      badgeColor: 'yellow',
      route: '/estudos/questoes/praticar',
    });
  } else if (ctx.study.streak > 0 && ctx.study.sessionsTotalToday > 0 && ctx.study.sessionsCompletedToday === 0) {
    // Sessões planejadas mas nenhuma feita → sequência em risco
    progress.push({
      id: 'study-streak-risk',
      module: 'study',
      score: 25,
      zone: 'progress',
      title: 'Sequência em risco',
      subtitle: `🔥 ${ctx.study.streak}d sem sessão hoje`,
      badgeColor: 'yellow',
      route: '/estudos/questoes/praticar',
    });
  } else if (ctx.study.sessionsCompletedToday > 0 || ctx.study.todayMinutes > 0) {
    progress.push({
      id: 'study-done',
      module: 'study',
      score: 15,
      zone: 'progress',
      title: 'Estudou hoje',
      subtitle: `${ctx.study.todayMinutes} min${ctx.study.streak > 0 ? ` · 🔥 ${ctx.study.streak}d` : ''}`,
      badgeColor: 'green',
      route: '/estudos',
    });
  }

  // ── Fitness ──────────────────────────────────────────────────────────────────
  const daysSince = ctx.fitness.daysSinceLastWorkout;

  if (daysSince !== null && daysSince >= 5) {
    now.push({
      id: 'fitness-long-rest',
      module: 'fitness',
      score: 70,
      zone: 'now',
      title: `${daysSince} dias sem treinar`,
      subtitle: 'Longa pausa',
      badgeColor: 'red',
      route: '/fitness',
    });
  } else if (ctx.fitness.workedOutToday) {
    progress.push({
      id: 'fitness-done',
      module: 'fitness',
      score: 15,
      zone: 'progress',
      title: 'Treinou hoje',
      subtitle: ctx.fitness.todayWorkoutType ?? undefined,
      badgeColor: 'green',
      route: '/fitness',
    });
  } else if (daysSince !== null && daysSince >= 3) {
    progress.push({
      id: 'fitness-short-rest',
      module: 'fitness',
      score: 50,
      zone: 'progress',
      title: `${daysSince} dias sem treinar`,
      subtitle: 'Considere uma sessão hoje',
      badgeColor: 'yellow',
      route: '/fitness',
    });
  }

  // ── Goals ────────────────────────────────────────────────────────────────────
  if (ctx.goals.nearestDeadline) {
    const { title, daysLeft } = ctx.goals.nearestDeadline;
    if (daysLeft <= 3) {
      now.push({
        id: 'goals-urgent',
        module: 'goals',
        score: 75,
        zone: 'now',
        title: `Meta vence ${daysLeft <= 0 ? 'hoje' : daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`}`,
        subtitle: title,
        badgeColor: 'red',
        route: '/metas',
      });
    } else if (daysLeft <= 7) {
      progress.push({
        id: 'goals-near',
        module: 'goals',
        score: 45,
        zone: 'progress',
        title: `Meta em ${daysLeft} dias`,
        subtitle: title,
        badgeColor: 'yellow',
        route: '/metas',
      });
    } else if (ctx.goals.activeCount > 0) {
      progress.push({
        id: 'goals-active',
        module: 'goals',
        score: 10,
        zone: 'progress',
        title: `${ctx.goals.activeCount} ${pluralPt(ctx.goals.activeCount, 'meta ativa', 'metas ativas')}`,
        subtitle:
          ctx.goals.urgentCount > 0
            ? `${ctx.goals.urgentCount} urgente${ctx.goals.urgentCount !== 1 ? 's' : ''}`
            : undefined,
        badgeColor: ctx.goals.urgentCount > 0 ? 'yellow' : 'muted',
        route: '/metas',
      });
    }
  } else if (ctx.goals.activeCount > 0) {
    progress.push({
      id: 'goals-active',
      module: 'goals',
      score: 10,
      zone: 'progress',
      title: `${ctx.goals.activeCount} ${pluralPt(ctx.goals.activeCount, 'meta ativa', 'metas ativas')}`,
      badgeColor: 'muted',
      route: '/metas',
    });
  }

  // ── Planner → PRÓXIMO ────────────────────────────────────────────────────────
  if (ctx.planner.nextSession) {
    const { topic, startTime } = ctx.planner.nextSession;
    next.push({
      id: 'planner-next',
      module: 'planner',
      score: 0,
      zone: 'next',
      title: topic,
      subtitle: startTime ? `Planner · ${startTime}` : 'Planner · hoje',
      badgeColor: 'blue',
      route: '/planner',
    });
  }

  // Progresso semanal do planner
  if (ctx.planner.weekTotal > 0) {
    progress.push({
      id: 'planner-week',
      module: 'planner',
      score: 15,
      zone: 'progress',
      title: `${ctx.planner.weekDone}/${ctx.planner.weekTotal} sessões na semana`,
      subtitle: 'Planner',
      badgeColor: ctx.planner.weekDone >= ctx.planner.weekTotal ? 'green' : 'muted',
      route: '/planner',
    });
  }

  // Ordena cada zona por score decrescente
  now.sort((a, b) => b.score - a.score);
  progress.sort((a, b) => b.score - a.score);

  return { now, progress, next };
}
