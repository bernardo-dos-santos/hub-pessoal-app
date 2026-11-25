import { backupService } from '../backup/backupService';
import { apiStorageAdapter, primeApiCache } from './apiStorageAdapter';
import { localStorageAdapter, migrateLegacyLocalKeys, setLocalNamespace } from './local-storage.adapter';
import { getSession, loadSession } from '../session/session';
import { setActiveAdapter } from './storage.adapter';
import { apiUrl, chooseBackendBase } from '../config/backendConfig';

const RETIRED_KEYS = ['study.weeklyPlan', 'study.routine'];

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
  // APK (Capacitor): Tailscale when it answers, otherwise the public address.
  await chooseBackendBase();

  // Whose data before which data: the local namespace (and so the merge
  // below) must belong to the user the backend says this is.
  migrateLegacyLocalKeys();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOOT_TIMEOUT_MS);
  const sessionLoad = await loadSession(controller.signal);
  setLocalNamespace(getSession().id);
  if (sessionLoad === 'denied') {
    clearTimeout(timeout);
    setActiveAdapter(localStorageAdapter);
    _currentMode = 'local';
    return 'local';
  }

  try {
    const res = await fetch(apiUrl('/api/store'), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`backend respondeu ${res.status}`);
    const snapshot: Record<string, unknown> = await res.json();

    // Keys renamed long ago (the server moves them at boot, server/db.js). An old
    // offline copy must not push them back — a stale `study.weeklyPlan` from June
    // was what the evening push kept reading.
    for (const key of RETIRED_KEYS) localStorageAdapter.removeItem(key);

    // Merge de localStorage → SQLite: copia chaves que existem no localStorage
    // mas ainda não estão no SQLite. Garante que dados gravados em modo local
    // (bootstrap timeout, troca de porta) não se percam ao voltar para api mode.
    const local = backupService.exportData().data;
    const missingEntries = Object.entries(local).filter(([key]) => !(key in snapshot) && !RETIRED_KEYS.includes(key));
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
  // The phone may have joined or left the tailnet since the boot.
  await chooseBackendBase();

  const url = apiUrl('/api/store');
  console.log('[resync] tentando conectar em:', url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // The user may differ from the one the page booted with (e.g. the first
    // boot was offline); the store snapshot is theirs, so the session must be too.
    await loadSession(controller.signal);
    setLocalNamespace(getSession().id);
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
