import { storageAdapter } from '../storage/storage.adapter';
import { getApiCacheEntries, isApiCachePrimed } from '../storage/apiStorageAdapter';
import { listLocalEntries } from '../storage/local-storage.adapter';
import { localDayKey } from '../../shared/dates/localDay';

const HUB_KEY_PREFIXES = ['finance.', 'fitness.', 'college.', 'rpg.', 'study.', 'goals.', 'ai.', 'planner.'];
const BACKUP_VERSION = 1;

export type HubBackup = {
  version: number;
  exportedAt: string;
  appName: string;
  data: Record<string, unknown>;
};

export type BackupSummary = {
  keys: number;
  modules: string[];
  sizeKb: number;
};

function isHubKey(key: string): boolean {
  return HUB_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Lê todos os pares chave/valor do storage ativo (API cache ou localStorage). */
function getAllHubEntries(): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (isApiCachePrimed()) {
    // Modo backend: usa o cache em memória do apiStorageAdapter
    const all = getApiCacheEntries();
    for (const [key, value] of Object.entries(all)) {
      if (isHubKey(key)) data[key] = value;
    }
    return data;
  }

  // Modo standalone: o localStorage do usuário atual
  for (const [key, value] of Object.entries(listLocalEntries())) {
    if (isHubKey(key)) data[key] = value;
  }
  return data;
}

export const backupService = {
  exportData(): HubBackup {
    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      appName: 'Olimpo',
      data: getAllHubEntries(),
    };
  },

  getSummary(): BackupSummary {
    const data = getAllHubEntries();
    const keys = Object.keys(data);
    const modules = [...new Set(keys.map((k) => k.split('.')[0]))];
    const backup = this.exportData();
    const sizeKb = Math.round(JSON.stringify(backup).length / 1024);
    return { keys: keys.length, modules, sizeKb };
  },

  downloadBackup(): void {
    const backup = this.exportData();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = localDayKey();
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub-pessoal-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  validateBackup(data: unknown): data is HubBackup {
    if (!data || typeof data !== 'object') return false;
    const backup = data as Partial<HubBackup>;
    return (
      typeof backup.version === 'number' &&
      typeof backup.exportedAt === 'string' &&
      typeof backup.data === 'object' &&
      backup.data !== null
    );
  },

  importBackup(backup: HubBackup): { restored: number; skipped: number } {
    let restored = 0;
    let skipped = 0;
    for (const [key, value] of Object.entries(backup.data)) {
      if (!isHubKey(key)) { skipped++; continue; }
      try {
        storageAdapter.setItem(key, value);
        restored++;
      } catch {
        skipped++;
      }
    }
    return { restored, skipped };
  },

  /** Exporta via API do servidor (retorna dados direto do banco SQLite). */
  async exportFromServer(): Promise<HubBackup | null> {
    try {
      const res = await fetch('/api/backup/export');
      if (!res.ok) return null;
      const data = await res.json() as HubBackup;
      return this.validateBackup(data) ? data : null;
    } catch {
      return null;
    }
  },

  /** Importa via API do servidor (escreve diretamente no banco SQLite). */
  async importToServer(backup: HubBackup): Promise<{ restored: number; skipped: number } | null> {
    try {
      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      });
      if (!res.ok) return null;
      return await res.json() as { restored: number; skipped: number };
    } catch {
      return null;
    }
  },
};
