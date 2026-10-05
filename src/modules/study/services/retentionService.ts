import { storageAdapter } from '../../../core/storage/storage.adapter';

type RetentionEntry = {
  date: string; // YYYY-MM-DD
  correct: number;
  total: number;
  mode: 'flashcard' | 'questoes';
};

const KEY = 'study.retentionLog';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const retentionService = {
  getLog(): RetentionEntry[] {
    return storageAdapter.getItem<RetentionEntry[]>(KEY) ?? [];
  },

  record(mode: RetentionEntry['mode'], correct: number, total: number): void {
    if (total === 0) return;
    const entry: RetentionEntry = { date: today(), correct, total, mode };
    const log = this.getLog();
    storageAdapter.setItem(KEY, [...log, entry]);
  },

  getLastSessionRate(): number | null {
    const log = this.getLog();
    if (log.length === 0) return null;
    const last = log[log.length - 1];
    return last.total > 0 ? Math.round((last.correct / last.total) * 100) : null;
  },

  getRecentRate(days: number): number | null {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recent = this.getLog().filter((e) => e.date >= cutoffStr);
    if (recent.length === 0) return null;
    const totalCorrect = recent.reduce((s, e) => s + e.correct, 0);
    const totalAttempts = recent.reduce((s, e) => s + e.total, 0);
    return totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;
  },
};
