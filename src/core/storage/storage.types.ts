export type StorageKey = string;

export type StorageAdapter = {
  getItem<T>(key: StorageKey): T | null;
  setItem<T>(key: StorageKey, value: T): void;
  removeItem(key: StorageKey): void;
  clear(): void;
};
