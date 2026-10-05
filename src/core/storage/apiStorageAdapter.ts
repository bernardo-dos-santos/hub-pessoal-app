import { type StorageAdapter, type StorageKey } from './storage.types';
import { apiUrl } from '../config/backendConfig';

// Adapter que fala com o backend, mas mantém a interface SÍNCRONA do StorageAdapter:
// um cache em memória (preenchido no boot) responde as leituras na hora, e as
// escritas atualizam o cache e disparam um PUT em background (write-through).

const cache = new Map<string, unknown>();
let primed = false;
const pendingWrites = new Map<string, Promise<void>>();
/** Chaves cuja última escrita no backend falhou — existem só em memória. */
const failedWrites = new Set<string>();

function enqueueRemoteWrite(key: string, write: () => Promise<void>): void {
  // Serializa mutacoes por chave para evitar que um PUT antigo chegue por ultimo
  // e sobrescreva uma versao mais nova do mesmo array no backend.
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(write);

  pendingWrites.set(key, next);
  void next.finally(() => {
    if (pendingWrites.get(key) === next) {
      pendingWrites.delete(key);
    }
  });
}

/**
 * `keepalive` deixa o PUT sobreviver ao fechamento da aba, mas a spec do Fetch
 * limita o corpo dessas requisições a 64KB — acima disso o navegador rejeita
 * antes de enviar. Chaves pequenas (regras, configuração) cabem; um array com
 * centenas de transações não, e a escrita morria calada: o valor ficava só no
 * cache em memória e sumia no recarregamento seguinte.
 */
const KEEPALIVE_MAX_BYTES = 60 * 1024;

async function putRemote(key: string, value: unknown): Promise<void> {
  const body = JSON.stringify({ value });
  const res = await fetch(apiUrl(`/api/store/${encodeURIComponent(key)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: body.length <= KEEPALIVE_MAX_BYTES,
  });

  // `fetch` só rejeita em falha de rede: sem esta checagem, um 413/429/500
  // passava como sucesso e o dado era dado por salvo sem nunca ter sido.
  if (!res.ok) {
    throw new Error(`PUT ${key} → HTTP ${res.status}`);
  }
}

async function deleteRemote(key: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/store/${encodeURIComponent(key)}`), {
    method: 'DELETE',
    keepalive: true,
  });

  // 404 é resultado aceitável: a chave já não existe, que é o estado desejado.
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${key} → HTTP ${res.status}`);
  }
}

export const apiStorageAdapter: StorageAdapter = {
  getItem<T>(key: StorageKey): T | null {
    return cache.has(key) ? (cache.get(key) as T) : null;
  },
  setItem<T>(key: StorageKey, value: T): void {
    cache.set(key, value);
    enqueueRemoteWrite(key, async () => {
      try {
        await putRemote(key, value);
        failedWrites.delete(key);
      } catch (err) {
        failedWrites.add(key);
        console.warn('[apiStore] PUT falhou para', key, err);
      }
    });
  },
  removeItem(key: StorageKey): void {
    cache.delete(key);
    enqueueRemoteWrite(key, async () => {
      try {
        await deleteRemote(key);
        failedWrites.delete(key);
      } catch (err) {
        failedWrites.add(key);
        console.warn('[apiStore] DELETE falhou para', key, err);
      }
    });
  },
  clear(): void {
    // Limpa só o cache local; não apaga o banco inteiro por segurança.
    cache.clear();
  },
};

/**
 * Espera as escritas em voo e diz quais chaves não chegaram ao backend.
 *
 * As escritas são disparadas em background para manter a interface síncrona do
 * StorageAdapter, então uma tela que acabou de salvar algo importante precisa
 * de um jeito de confirmar que o dado saiu da memória — sem isso o usuário vê
 * "salvo", recarrega e perde tudo.
 */
export async function flushPendingWrites(): Promise<string[]> {
  await Promise.allSettled([...pendingWrites.values()]);
  return [...failedWrites];
}

/** Preenche o cache com o snapshot vindo do backend (chamado no bootstrap). */
export function primeApiCache(snapshot: Record<string, unknown>): void {
  cache.clear();
  for (const [key, value] of Object.entries(snapshot)) cache.set(key, value);
  primed = true;
}

export function isApiCachePrimed(): boolean {
  return primed;
}

/** Retorna uma cópia de todas as entradas do cache (usado pelo backupService). */
export function getApiCacheEntries(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of cache.entries()) result[key] = value;
  return result;
}

/**
 * Busca uma chave específica do backend e atualiza o cache local.
 * Usado após ações do JARVIS que escrevem diretamente no SQLite.
 */
export async function refreshKey(key: string): Promise<void> {
  try {
    const res = await fetch(apiUrl(`/api/store/${encodeURIComponent(key)}`));
    if (res.ok) {
      const { value } = await res.json();
      cache.set(key, value);
    } else if (res.status === 404) {
      cache.delete(key);
    }
  } catch {
    // silent — cache permanece como estava
  }
}
