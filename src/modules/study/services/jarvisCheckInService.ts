import { updateDailyContext } from '../../../core/context/dailyContext';
import { storageAdapter } from '../../../core/storage/storage.adapter';

const STORAGE_KEY = 'jarvis.checkIns';

export type CheckIn = {
  mood: number;       // 1-5
  energy: number;     // 1-5
  hoursSlept: number; // 1-12
  note?: string;
  recordedAt: string;
};

type CheckInMap = Record<string, CheckIn>; // key = YYYY-MM-DD

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMap(): CheckInMap {
  return storageAdapter.getItem<CheckInMap>(STORAGE_KEY) ?? {};
}

export const jarvisCheckInService = {
  saveTodayCheckIn(mood: number, energy: number, hoursSlept: number, note?: string): void {
    const map = getMap();
    map[todayStr()] = { mood, energy, hoursSlept, note, recordedAt: new Date().toISOString() };
    storageAdapter.setItem(STORAGE_KEY, map);
    updateDailyContext({ checkIn: { done: true, mood, energy, hoursSlept } });
  },

  getTodayCheckIn(): CheckIn | null {
    return getMap()[todayStr()] ?? null;
  },

  dismissToday(): void {
    // Mark today as dismissed (skip without filling) — use a sentinel value
    const map = getMap();
    if (!map[todayStr()]) {
      map[todayStr()] = { mood: 0, energy: 0, hoursSlept: 0, recordedAt: new Date().toISOString() };
    }
    storageAdapter.setItem(STORAGE_KEY, map);
  },

  isDismissedOrFilled(): boolean {
    return getMap()[todayStr()] != null;
  },

  getCheckInHistory(days: number): Array<{ date: string } & CheckIn> {
    const map = getMap();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return Object.entries(map)
      .filter(([date, c]) => date >= cutoffStr && c.mood > 0)
      .map(([date, c]) => ({ date, ...c }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  getAverageScores(days: number): { mood: number; energy: number; hoursSlept: number } | null {
    const history = this.getCheckInHistory(days);
    if (history.length === 0) return null;
    const sum = history.reduce(
      (acc, c) => ({ mood: acc.mood + c.mood, energy: acc.energy + c.energy, hoursSlept: acc.hoursSlept + c.hoursSlept }),
      { mood: 0, energy: 0, hoursSlept: 0 },
    );
    const n = history.length;
    return {
      mood: Math.round((sum.mood / n) * 10) / 10,
      energy: Math.round((sum.energy / n) * 10) / 10,
      hoursSlept: Math.round((sum.hoursSlept / n) * 10) / 10,
    };
  },

  getBurnoutRisk(): 'low' | 'medium' | 'high' {
    const avg = this.getAverageScores(3);
    if (!avg) return 'low';
    if (avg.energy <= 2 && avg.mood <= 2) return 'high';
    if (avg.energy <= 2.5 || avg.mood <= 2.5) return 'medium';
    return 'low';
  },
};
