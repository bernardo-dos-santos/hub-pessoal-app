import { storageAdapter } from '../storage/storage.adapter';

const KEY = 'concurso.abin.checkIns';

export type AbinCheckIn = {
  id: string;
  weekStart: string; // ISO date string da segunda-feira da semana
  hoursStudied: number;
  questionsResolved: number;
  accuracyPct: number; // 0–100
  trainingDone: boolean;
  note: string;
  createdAt: string;
};

export const abinCheckInService = {
  list(): AbinCheckIn[] {
    return storageAdapter.getItem<AbinCheckIn[]>(KEY) ?? [];
  },

  getThisWeek(): AbinCheckIn | null {
    const monday = getMonday(new Date()).toISOString().split('T')[0];
    return this.list().find((c) => c.weekStart === monday) ?? null;
  },

  save(data: Omit<AbinCheckIn, 'id' | 'createdAt' | 'weekStart'>): AbinCheckIn {
    const monday = getMonday(new Date()).toISOString().split('T')[0];
    const all = this.list();
    const existing = all.findIndex((c) => c.weekStart === monday);

    const entry: AbinCheckIn = {
      id: existing >= 0 ? all[existing].id : crypto.randomUUID(),
      weekStart: monday,
      createdAt: existing >= 0 ? all[existing].createdAt : new Date().toISOString(),
      ...data,
    };

    if (existing >= 0) {
      all[existing] = entry;
    } else {
      all.unshift(entry);
    }

    storageAdapter.setItem(KEY, all);
    return entry;
  },

  delete(id: string): void {
    const all = this.list().filter((c) => c.id !== id);
    storageAdapter.setItem(KEY, all);
  },
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
