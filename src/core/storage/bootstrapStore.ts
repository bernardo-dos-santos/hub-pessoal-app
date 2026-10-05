import { backupService } from '../backup/backupService';
import { apiStorageAdapter, primeApiCache } from './apiStorageAdapter';
import { localStorageAdapter } from './local-storage.adapter';
import { setActiveAdapter } from './storage.adapter';
import { apiUrl, isCapacitorApp, setBackendBase, TAILSCALE_BACKEND } from '../config/backendConfig';

const BOOT_TIMEOUT_MS = 5000;

export type StoreMode = 'api' | 'local';

let _currentMode: StoreMode = 'local';

/** Retorna o modo de armazenamento ativo ('api' ou 'local'). */
export function getStoreMode(): StoreMode {
  return _currentMode;
}

async function putKey(key: string, value: unknown): Promise<void> {
  await fetch(apiUrl(`/api/store/${encodeURIComponent(key)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}

/**
 * Decide a fonte de dados no boot:
 * - Backend respondeu → usa apiStorageAdapter (cache + write-through).
 *   Se o banco estiver vazio e houver dados no localStorage, faz o seed inicial.
 * - Backend indisponível → cai no localStorageAdapter (modo standalone).
 */
export async function bootstrapStore(): Promise<StoreMode> {
  // APK (Capacitor): aponta para o backend via Tailscale antes de tentar
  if (isCapacitorApp()) setBackendBase(TAILSCALE_BACKEND);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BOOT_TIMEOUT_MS);
    const res = await fetch(apiUrl('/api/store'), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`backend respondeu ${res.status}`);
    const snapshot: Record<string, unknown> = await res.json();

    // Migração de namespace: study.weeklyPlan → planner.weeklyPlan, study.routine → planner.routine
    const namespaceMigrations: Array<[string, string]> = [
      ['study.weeklyPlan', 'planner.weeklyPlan'],
      ['study.routine', 'planner.routine'],
    ];
    for (const [oldKey, newKey] of namespaceMigrations) {
      if (snapshot[oldKey] !== undefined && snapshot[newKey] === undefined) {
        await putKey(newKey, snapshot[oldKey]);
        console.log(`[store] migração: ${oldKey} → ${newKey}`);
      }
    }

    // Merge de localStorage → SQLite: copia chaves que existem no localStorage
    // mas ainda não estão no SQLite. Garante que dados gravados em modo local
    // (bootstrap timeout, troca de porta) não se percam ao voltar para api mode.
    const local = backupService.exportData().data;
    const missingEntries = Object.entries(local).filter(([key]) => !(key in snapshot));
    if (missingEntries.length > 0) {
      await Promise.all(missingEntries.map(([key, value]) => putKey(key, value)));
      for (const [key, value] of missingEntries) snapshot[key] = value;
      console.log(`[store] merge localStorage→SQLite: ${missingEntries.length} chave(s) sincronizada(s).`);
    }

    primeApiCache(snapshot);

    setActiveAdapter(apiStorageAdapter);
    _currentMode = 'api';
    return 'api';
  } catch {
    setActiveAdapter(localStorageAdapter);
    _currentMode = 'local';
    console.log('[store] backend indisponível — usando localStorage (modo standalone).');
    return 'local';
  }
}

/**
 * Força um reload completo do cache a partir do backend.
 * Lança erro com detalhes se falhar (para o UI exibir).
 */
export async function resyncFromBackend(): Promise<StoreMode> {
  // Garante que o base URL está configurado (APK ou fallback por protocolo)
  setBackendBase(isCapacitorApp() ? TAILSCALE_BACKEND : '');

  const url = apiUrl('/api/store');
  console.log('[resync] tentando conectar em:', url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Servidor respondeu HTTP ${res.status}`);

    const snapshot: Record<string, unknown> = await res.json();
    primeApiCache(snapshot);
    setActiveAdapter(apiStorageAdapter);
    _currentMode = 'api';
    return 'api';
  } catch (err) {
    clearTimeout(timeout);
    _currentMode = 'local';
    const detail = err instanceof Error ? err.message : String(err);
    // Relança com URL para facilitar debug
    throw new Error(`[${url}] ${detail}`);
  }
}
