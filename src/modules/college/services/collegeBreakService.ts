import { storageAdapter } from '../../../core/storage/storage.adapter';

const KEY = 'college.semesterBreak';

/** Período de férias/entre semestres — datas em YYYY-MM-DD, ambas inclusive. */
export type SemesterBreak = {
  startDate: string;
  endDate: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const collegeBreakService = {
  get(): SemesterBreak | null {
    return storageAdapter.getItem<SemesterBreak>(KEY) ?? null;
  },

  set(breakPeriod: SemesterBreak): void {
    storageAdapter.setItem(KEY, breakPeriod);
  },

  clear(): void {
    storageAdapter.removeItem(KEY);
  },

  /** Hoje cai dentro do período cadastrado (ambas as pontas inclusive)? */
  isOnBreak(period: SemesterBreak | null, today = todayStr()): boolean {
    if (!period) return false;
    return today >= period.startDate && today <= period.endDate;
  },
};
