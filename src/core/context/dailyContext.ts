import { storageAdapter } from '../storage/storage.adapter';

const STORAGE_KEY = 'hub.context.daily';

export interface DailyContext {
  date: string; // YYYY-MM-DD — detecta contexto stale ao virar o dia

  finance: {
    expensesToday: number;
    incomeToday: number;
    pendingReview: number;
    monthBalance: number;
    budgetsExceeded: number;
    invoicesDueSoon: number;
    monthlyReportMonth: string | null;
  };

  study: {
    sessionsCompletedToday: number;
    sessionsTotalToday: number;
    streak: number;
    todayMinutes: number;
    dueCards: number;
    dueQuestions: number;
  };

  planner: {
    sessionsCompletedToday: number;
    sessionsTotalToday: number;
    nextSession: { topic: string; startTime?: string } | null;
    weekDone: number;
    weekTotal: number;
  };

  fitness: {
    workedOutToday: boolean;
    todayWorkoutType: string | null;
    daysSinceLastWorkout: number | null;
  };

  goals: {
    activeCount: number;
    urgentCount: number;
    nearestDeadline: { title: string; daysLeft: number } | null;
  };

  college: {
    nextExam: { name: string; daysLeft: number } | null;
    urgentTasks: number;
  };

  checkIn: {
    done: boolean;
    mood: number | null;
    energy: number | null;
    hoursSlept: number | null;
  };
}

type DailyContextPatch = {
  [K in keyof Omit<DailyContext, 'date'>]?: Partial<DailyContext[K]>;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyContext(): DailyContext {
  return {
    date: today(),
    finance: { expensesToday: 0, incomeToday: 0, pendingReview: 0, monthBalance: 0, budgetsExceeded: 0, invoicesDueSoon: 0, monthlyReportMonth: null },
    study: { sessionsCompletedToday: 0, sessionsTotalToday: 0, streak: 0, todayMinutes: 0, dueCards: 0, dueQuestions: 0 },
    planner: { sessionsCompletedToday: 0, sessionsTotalToday: 0, nextSession: null, weekDone: 0, weekTotal: 0 },
    fitness: { workedOutToday: false, todayWorkoutType: null, daysSinceLastWorkout: null },
    goals: { activeCount: 0, urgentCount: 0, nearestDeadline: null },
    college: { nextExam: null, urgentTasks: 0 },
    checkIn: { done: false, mood: null, energy: null, hoursSlept: null },
  };
}

export function getDailyContext(): DailyContext {
  const stored = storageAdapter.getItem<DailyContext>(STORAGE_KEY);
  if (!stored || stored.date !== today()) return emptyContext();
  // Merge com defaults para migração transparente quando novas seções são adicionadas
  const defaults = emptyContext();
  return {
    date: stored.date,
    finance: { ...defaults.finance, ...stored.finance },
    study: { ...defaults.study, ...stored.study },
    planner: { ...defaults.planner, ...stored.planner },
    fitness: { ...defaults.fitness, ...stored.fitness },
    goals: { ...defaults.goals, ...stored.goals },
    college: { ...defaults.college, ...stored.college },
    checkIn: { ...defaults.checkIn, ...stored.checkIn },
  };
}

export function updateDailyContext(patch: DailyContextPatch): void {
  const current = getDailyContext();
  const updated: DailyContext = {
    date: today(),
    finance: { ...current.finance, ...patch.finance },
    study: { ...current.study, ...patch.study },
    planner: { ...current.planner, ...patch.planner },
    fitness: { ...current.fitness, ...patch.fitness },
    goals: { ...current.goals, ...patch.goals },
    college: { ...current.college, ...patch.college },
    checkIn: { ...current.checkIn, ...patch.checkIn },
  };
  storageAdapter.setItem(STORAGE_KEY, updated);
}
