import { useSyncExternalStore } from 'react';
import { aiConfig } from './aiConfig';

// Notifica componentes quando a config de IA muda (ex.: salvar chave em outra aba/tela).
const listeners = new Set<() => void>();

export function notifyAiConfigChanged(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Retorna true quando a IA está configurada e habilitada. Reativo a mudanças. */
export function useAiAvailable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => aiConfig.isReady(),
    () => false,
  );
}
