import { storageAdapter } from '../../../core/storage/storage.adapter';

const ACTIVITY_KEY = 'study.activityLog';

type ActivityEntry = {
  date: string;
  activities: string[];
  durationMinutes: number;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLog(): ActivityEntry[] {
  return storageAdapter.getItem<ActivityEntry[]>(ACTIVITY_KEY) ?? [];
}

export const studySessionService = {
  recordActivity(type: string, durationMinutes = 0): void {
    const today = todayStr();
    const log = getLog();
    const existing = log.find((e) => e.date === today);
    if (existing) {
      existing.activities.push(type);
      existing.durationMinutes += durationMinutes;
    } else {
      log.unshift({ date: today, activities: [type], durationMinutes });
    }
    storageAdapter.setItem(ACTIVITY_KEY, log);
  },

  getStreak(): number {
    const log = getLog();
    if (log.length === 0) return 0;
    const today = todayStr();
    const sorted = [...log].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    let expected = today;
    for (const entry of sorted) {
      if (entry.date === expected) {
        streak++;
        const d = new Date(expected + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else if (entry.date < expected) {
        break;
      }
    }
    return streak;
  },

  getTodayMinutes(): number {
    const today = todayStr();
    return getLog().find((e) => e.date === today)?.durationMinutes ?? 0;
  },

  getRecentLog(days = 7): ActivityEntry[] {
    const log = getLog();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return log
      .filter((e) => e.date >= cutoffStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
};
