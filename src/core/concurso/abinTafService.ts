import { storageAdapter } from '../storage/storage.adapter';

const KEY = 'fitness.abin.workouts';

export type AbinTafType = 'swimming' | 'run12min';

export type AbinTafLog = {
  id: string;
  date: string;         // ISO date string (YYYY-MM-DD)
  type: AbinTafType;
  /** Natação: metros percorridos. Corrida 12min: metros percorridos. */
  distanceMeters: number;
  note: string;
  createdAt: string;
};

export const ABIN_TAF_LABEL: Record<AbinTafType, string> = {
  swimming: '🏊 Natação',
  run12min: '🏃 Corrida 12min',
};

/** Mínimos esperados (serão definidos no edital — valores de referência) */
export const ABIN_TAF_REFERENCE: Record<AbinTafType, { distance: number; label: string }> = {
  swimming:  { distance: 300,  label: '300m (estimativa)' },
  run12min:  { distance: 2400, label: '2400m (estimativa)' },
};

export const abinTafService = {
  list(): AbinTafLog[] {
    return storageAdapter.getItem<AbinTafLog[]>(KEY) ?? [];
  },

  listByType(type: AbinTafType): AbinTafLog[] {
    return this.list().filter((w) => w.type === type);
  },

  getBest(type: AbinTafType): number | null {
    const logs = this.listByType(type);
    if (!logs.length) return null;
    return Math.max(...logs.map((l) => l.distanceMeters));
  },

  add(data: Omit<AbinTafLog, 'id' | 'createdAt'>): AbinTafLog {
    const all = this.list();
    const entry: AbinTafLog = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    all.unshift(entry);
    storageAdapter.setItem(KEY, all);
    return entry;
  },

  delete(id: string): void {
    const all = this.list().filter((l) => l.id !== id);
    storageAdapter.setItem(KEY, all);
  },
};
