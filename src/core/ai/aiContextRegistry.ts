import { type AiContextProvider } from './ai-types';

// Cada módulo registra um provider de contexto (espelha o alertRegistry).
// Usado pelo "Pergunte ao Hub" (fase futura) para montar o contexto agregado.
const providers: AiContextProvider[] = [];

export function registerAiContextProvider(provider: AiContextProvider): void {
  if (!providers.some((p) => p.moduleId === provider.moduleId)) {
    providers.push(provider);
  }
}

export function buildAiContext(): string {
  return providers
    .map((p) => p.getAiContext())
    .filter((text) => text.trim())
    .join('\n\n');
}
