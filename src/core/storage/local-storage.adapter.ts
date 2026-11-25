import { type StorageAdapter } from './storage.types';
import { type StorageKey } from './storage.types';

/**
 * Every key lives under the user's namespace (`u<id>:module.thing`). One
 * browser can serve more than one user — the admin "viewing as" the test
 * user, a shared family notebook — and the boot merges local keys into the
 * server snapshot: without the namespace, one user's offline copy would be
 * pushed into another user's account.
 */
let namespace = 'u1:';

/** Pre-namespace keys (`module.thing`) — written before multi-user, all of them the owner's. */
const LEGACY_KEY = /^[a-z]+\./;
const OWNER_NAMESPACE = 'u1:';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function setLocalNamespace(userId: number): void {
  namespace = `u${userId}:`;
}

/** Moves pre-multi-user keys into the owner's namespace. Idempotent. */
export function migrateLegacyLocalKeys(): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const legacy: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && LEGACY_KEY.test(key)) legacy.push(key);
  }
  for (const key of legacy) {
    const value = storage.getItem(key);
    if (value !== null && storage.getItem(OWNER_NAMESPACE + key) === null) storage.setItem(OWNER_NAMESPACE + key, value);
    storage.removeItem(key);
  }
}

/** Every entry of the current user's namespace, keyed without the prefix. */
export function listLocalEntries(): Record<string, unknown> {
  const storage = getLocalStorage();
  const data: Record<string, unknown> = {};
  if (!storage) return data;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(namespace)) continue;
    const raw = storage.getItem(key);
    try {
      data[key.slice(namespace.length)] = raw ? JSON.parse(raw) : null;
    } catch {
      data[key.slice(namespace.length)] = raw;
    }
  }
  return data;
}

export const localStorageAdapter: StorageAdapter = {
  getItem<T>(key: StorageKey): T | null {
    const storage = getLocalStorage();
    const rawValue = storage?.getItem(namespace + key);

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return null;
    }
  },
  setItem<T>(key: StorageKey, value: T): void {
    getLocalStorage()?.setItem(namespace + key, JSON.stringify(value));
  },
  removeItem(key: StorageKey): void {
    getLocalStorage()?.removeItem(namespace + key);
  },
  clear(): void {
    for (const key of Object.keys(listLocalEntries())) getLocalStorage()?.removeItem(namespace + key);
  },
};
