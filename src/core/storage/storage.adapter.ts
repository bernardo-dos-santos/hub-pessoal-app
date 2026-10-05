import { localStorageAdapter } from './local-storage.adapter';
import { type StorageAdapter, type StorageKey } from './storage.types';

// Adapter ativo, escolhido no boot (bootstrapStore): API (com backend) ou localStorage.
// Default é localStorage para o app funcionar mesmo antes/sem o bootstrap.
let active: StorageAdapter = localStorageAdapter;

export function setActiveAdapter(adapter: StorageAdapter): void {
  active = adapter;
}

// Proxy estável: os ~20 services importam este objeto e nunca precisam saber
// qual implementação está por trás.
export const storageAdapter: StorageAdapter = {
  getItem<T>(key: StorageKey): T | null {
    return active.getItem<T>(key);
  },
  setItem<T>(key: StorageKey, value: T): void {
    active.setItem<T>(key, value);
  },
  removeItem(key: StorageKey): void {
    active.removeItem(key);
  },
  clear(): void {
    active.clear();
  },
};
