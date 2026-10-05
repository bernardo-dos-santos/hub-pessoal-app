// Reconstrói o DailyContext lendo todos os serviços de uma vez.
// Chamado no boot (após bootstrapStore) e quando o dia muda.
// Não é importado por nenhum serviço — só por main.tsx e hooks de app.

import { financeSummaryService } from '../../modules/finance/services/financeSummaryService';
import { transactionService } from '../../modules/finance/services/transactionService';
import { budgetService } from '../../modules/finance/services/budgetService';
import { invoiceService } from '../../modules/finance/services/invoiceService';
import { studySessionService } from '../../modules/study/services/studySessionService';
import { deckService } from '../../modules/study/services/deckService';
import { sessionCompletionService } from '../../modules/study/services/sessionCompletionService';
import { weeklyPlanService } from '../../modules/planner/services/weeklyPlanService';
import { goalService } from '../../modules/goals/services/goalService';
import { workoutService } from '../../modules/fitness/services/workoutService';
import { fitnessStatisticsService } from '../../modules/fitness/services/fitnessStatisticsService';
import { assessmentService } from '../../modules/college/services/assessmentService';
import { taskService } from '../../modules/college/services/taskService';
import { subjectService } from '../../modules/college/services/subjectService';
import { storageAdapter } from '../storage/storage.adapter';
import { updateDailyContext } from './dailyContext';

const MS_PER_DAY = 86_400_000;

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / MS_PER_DAY);
}

function sevenDaysFromNow(): string {
  return new Date(Date.now() + 7 * MS_PER_DAY).toISOString().slice(0, 10);
}

function threeDaysFromNow(): string {
  return new Date(Date.now() + 3 * MS_PER_DAY).toISOString().slice(0, 10);
}

export function rebuildDailyContext(): void {
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Finance ─────────────────────────────────────────────────────────────────
  try {
    const summary = financeSummaryService.getFinanceSummary();
    const transactions = transactionService.listTransactions();
    const budgetSummary = budgetService.getBudgetsSummary(transactions);
    const cutoff = sevenDaysFromNow();
    const invoicesDueSoon = invoiceService
      .listInvoices()
      .filter((inv) => inv.dueDate && inv.dueDate <= cutoff && inv.status !== 'paid').length;

    // Resumo mensal disponível?
    const prevMonthDate = new Date();
    prevMonthDate.setDate(1);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const hasMonthlySummary = !!storageAdapter.getItem(`finance.monthly-summary.${prevMonthKey}`);

    updateDailyContext({
      finance: {
        monthBalance: summary.balance,
        pendingReview: summary.pendingIncomeReview + summary.pendingExpenseReview,
        budgetsExceeded: budgetSummary.exceeded,
        invoicesDueSoon,
        monthlyReportMonth: hasMonthlySummary ? prevMonthKey : null,
      },
    });
  } catch (e) {
    console.warn('[context] finance rebuild failed:', e);
  }

  // ── Study ────────────────────────────────────────────────────────────────────
  try {
    // Exclusivo (não inclusivo): tira só matéria arquivada da faculdade, mantém
    // tópico de concurso — ver subjectService.listArchivedSubjectTags().
    const archivedTags = subjectService.listArchivedSubjectTags();
    updateDailyContext({
      study: {
        streak: studySessionService.getStreak(),
        todayMinutes: studySessionService.getTodayMinutes(),
        dueCards: deckService.dueCardsAllDecks(archivedTags).length,
        dueQuestions: deckService.dueQuestionsCount(archivedTags),
      },
    });
  } catch (e) {
    console.warn('[context] study rebuild failed:', e);
  }

  // ── Planner ─────────────────────────────────────────────────────────────────
  try {
    const plan = weeklyPlanService.getCurrentPlan();
    const todaySessions = sessionCompletionService.getTodaySessions();
    const weekOf = plan?.weekOf ?? null;
    const completions = weekOf ? sessionCompletionService.getWeekCompletions(weekOf) : {};

    const completedToday = todaySessions.filter(
      ({ index }) => completions[index] === 'done' || completions[index] === 'partial',
    ).length;

    const weekDone = Object.values(completions).filter(
      (s) => s === 'done' || s === 'partial',
    ).length;

    const nextRaw = todaySessions.find(({ index }) => !completions[index])?.session ?? null;
    const nextSession = nextRaw
      ? { topic: nextRaw.topic, startTime: nextRaw.startTime }
      : null;

    updateDailyContext({
      planner: {
        sessionsCompletedToday: completedToday,
        sessionsTotalToday: todaySessions.length,
        nextSession,
        weekDone,
        weekTotal: plan?.sessions.length ?? 0,
      },
    });
  } catch (e) {
    console.warn('[context] planner rebuild failed:', e);
  }

  // ── Goals ────────────────────────────────────────────────────────────────────
  try {
    const active = goalService.listActive();
    const cutoff = sevenDaysFromNow();
    const urgentCount = active.filter((g) => g.targetDate && g.targetDate <= cutoff).length;

    const withDate = active
      .filter((g): g is typeof g & { targetDate: string } => !!g.targetDate)
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

    const nearestDeadline =
      withDate.length > 0
        ? { title: withDate[0].title, daysLeft: daysUntil(withDate[0].targetDate) }
        : null;

    updateDailyContext({ goals: { activeCount: active.length, urgentCount, nearestDeadline } });
  } catch (e) {
    console.warn('[context] goals rebuild failed:', e);
  }

  // ── Fitness ─────────────────────────────────────────────────────────────────
  try {
    const todayWorkouts = workoutService.listWorkouts().filter((w) => w.date === todayStr);
    updateDailyContext({
      fitness: {
        workedOutToday: todayWorkouts.length > 0,
        todayWorkoutType: todayWorkouts[0]?.type ?? null,
        daysSinceLastWorkout: fitnessStatisticsService.getDaysSinceLastWorkout(),
      },
    });
  } catch (e) {
    console.warn('[context] fitness rebuild failed:', e);
  }

  // ── College ─────────────────────────────────────────────────────────────────
  try {
    const upcoming = assessmentService.listUpcomingAssessments(1);
    const taskCutoff = threeDaysFromNow();
    const urgentTasks = taskService
      .listTasks()
      .filter((t) => t.dueDate && t.dueDate <= taskCutoff && t.status !== 'done' && t.status !== 'canceled').length;

    const nextExam =
      upcoming.length > 0
        ? { name: upcoming[0].title, daysLeft: daysUntil(upcoming[0].date) }
        : null;

    updateDailyContext({ college: { nextExam, urgentTasks } });
  } catch (e) {
    console.warn('[context] college rebuild failed:', e);
  }
}
