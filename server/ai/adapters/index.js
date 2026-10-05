/**
 * Registro de adaptadores. Um provedor novo entra aqui e aparece sozinho no
 * seletor de cada slot — a tela de Configurações lê PROVIDER_META por
 * GET /api/ai/providers em vez de manter a própria lista.
 */

import { anthropicAdapter } from './anthropic.js';
import { geminiAdapter } from './gemini.js';
import { ollamaAdapter } from './ollama.js';

export const adapters = {
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
};

export function getAdapter(provider) {
  return adapters[provider] ?? null;
}

/** Metadados que a tela de Configurações precisa — nada de segredo aqui. */
export const PROVIDER_META = Object.values(adapters).map((a) => ({
  id: a.id,
  label: a.label,
  hint: a.hint,
  needsKey: a.needsKey,
  needsBaseUrl: a.needsBaseUrl,
  keyUrl: a.keyUrl ?? null,
  defaultModel: a.defaultModel,
  defaultBaseUrl: a.defaultBaseUrl ?? null,
  suggestedModels: a.suggestedModels ?? [],
}));
