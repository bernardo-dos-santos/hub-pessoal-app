import { type StorageAdapter } from './storage.types';
import { type StorageKey } from './storage.types';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export const localStorageAdapter: StorageAdapter = {
  getItem<T>(key: StorageKey): T | null {
    const storage = getLocalStorage();
    const rawValue = storage?.getItem(key);

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
    getLocalStorage()?.setItem(key, JSON.stringify(value));
  },
  removeItem(key: StorageKey): void {
    getLocalStorage()?.removeItem(key);
  },
  clear(): void {
    getLocalStorage()?.clear();
  },
};
