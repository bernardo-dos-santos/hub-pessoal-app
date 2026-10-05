import { storageAdapter } from '../../../core/storage/storage.adapter';

export type RpgSessionEntry = {
  id: string;
  timestamp: string;
  text: string;
  kind: 'dice' | 'rest' | 'action' | 'note';
};

const STORAGE_KEY = 'rpg.sessionLog';

function now(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const rpgSessionLogService = {
  getLog(): RpgSessionEntry[] {
    return storageAdapter.getItem<RpgSessionEntry[]>(STORAGE_KEY) ?? [];
  },

  addEntry(text: string, kind: RpgSessionEntry['kind']): RpgSessionEntry {
    const entry: RpgSessionEntry = { id: makeId(), timestamp: now(), text, kind };
    const log = this.getLog();
    // Mantém os últimos 100 registros da sessão
    const next = [entry, ...log].slice(0, 100);
    storageAdapter.setItem(STORAGE_KEY, next);
    return entry;
  },

  clearLog(): void {
    storageAdapter.setItem(STORAGE_KEY, []);
  },
};
