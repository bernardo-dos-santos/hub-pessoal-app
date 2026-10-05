import { updateDailyContext } from '../../../core/context/dailyContext';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { weeklyPlanService } from '../../planner/services/weeklyPlanService';
import { type WeekDay, type WeeklySession, WEEK_DAYS } from '../../planner/types/routine';

const STORAGE_KEY = 'study.sessionCompletions';

export type CompletionStatus = 'done' | 'partial' | 'skipped';

type CompletionMap = Record<string, CompletionStatus>;

function getMap(): CompletionMap {
  return storageAdapter.getItem<CompletionMap>(STORAGE_KEY) ?? {};
}

function sessionKey(weekOf: string, idx: number): string {
  return `${weekOf}:${idx}`;
}

function todayWeekDay(): WeekDay {
  const days: WeekDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

export const sessionCompletionService = {
  markSession(weekOf: string, sessionIndex: number, status: CompletionStatus): void {
    const map = getMap();
    map[sessionKey(weekOf, sessionIndex)] = status;
    storageAdapter.setItem(STORAGE_KEY, map);
    const plan = weeklyPlanService.getCurrentPlan();
    if (plan) {
      const todayDay = todayWeekDay();
      const todayIndices = plan.sessions
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.day === todayDay)
        .map(({ i }) => i);
      const updatedMap = getMap();
      const completedToday = todayIndices.filter(
        (i) => updatedMap[sessionKey(weekOf, i)] === 'done',
      ).length;
      updateDailyContext({
        study: { sessionsCompletedToday: completedToday, sessionsTotalToday: todayIndices.length },
      });
    }
  },

  getStatus(weekOf: string, sessionIndex: number): CompletionStatus | null {
    return getMap()[sessionKey(weekOf, sessionIndex)] ?? null;
  },

  getWeekCompletions(weekOf: string): Record<number, CompletionStatus> {
    const map = getMap();
    const result: Record<number, CompletionStatus> = {};
    const prefix = `${weekOf}:`;
    for (const [k, v] of Object.entries(map)) {
      if (k.startsWith(prefix)) {
        const idx = parseInt(k.slice(prefix.length), 10);
        if (!isNaN(idx)) result[idx] = v;
      }
    }
    return result;
  },

  getCompletionRate(weekOf: string, totalSessions: number): number {
    if (totalSessions === 0) return 100;
    const completions = this.getWeekCompletions(weekOf);
    const done = Object.values(completions).filter((s) => s === 'done' || s === 'partial').length;
    return Math.round((done / totalSessions) * 100);
  },

  getTodaySessions(): Array<{ session: WeeklySession; index: number }> {
    const plan = weeklyPlanService.getCurrentPlan();
    if (!plan) return [];
    const today = todayWeekDay();
    return plan.sessions
      .map((session, index) => ({ session, index }))
      .filter(({ session }) => session.day === today);
  },

  getMissedSessions(): Array<{ session: WeeklySession; index: number }> {
    const plan = weeklyPlanService.getCurrentPlan();
    if (!plan) return [];
    const completions = this.getWeekCompletions(plan.weekOf);
    const todayDay = todayWeekDay();
    const todayIdx = WEEK_DAYS.indexOf(todayDay);

    return plan.sessions
      .map((session, index) => ({ session, index }))
      .filter(({ session, index }) => {
        const sessionDayIdx = WEEK_DAYS.indexOf(session.day);
        // Only past days (before today)
        if (sessionDayIdx >= todayIdx) return false;
        const status = completions[index];
        return !status || status === 'skipped';
      });
  },

  getCurrentWeekOf(): string | null {
    return weeklyPlanService.getCurrentPlan()?.weekOf ?? null;
  },

  /**
   * Apaga as marcações de uma semana. Chamar sempre que o plano daquela semana
   * for descartado: as completions são indexadas por posição no plano
   * (`semana:índice`), então sem isto elas sobrariam apontando pra sessões que
   * não existem mais — e voltariam a valer se um plano novo fosse gerado pra
   * mesma semana, marcando como feitas sessões que nunca foram.
   */
  clearWeek(weekOf: string): number {
    const map = getMap();
    const prefix = `${weekOf}:`;
    let removed = 0;
    for (const key of Object.keys(map)) {
      if (key.startsWith(prefix)) {
        delete map[key];
        removed++;
      }
    }
    if (removed > 0) storageAdapter.setItem(STORAGE_KEY, map);
    return removed;
  },
};
