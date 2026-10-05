/**
 * aiSettings.js — os três slots de IA de um usuário.
 *
 * Cada slot é { provider, model, baseUrl } + uma chave. O que é público
 * (provedor, modelo, se tem chave) mora no kv_store, em `ai.settings`, porque o
 * frontend precisa ler isso de forma síncrona para saber se a IA está pronta. A
 * chave em si mora na tabela `secrets`, cifrada — o kv_store inteiro é servido
 * ao browser por GET /api/store, então segredo ali é segredo publicado.
 *
 * Papéis dos slots (decisão de 19/08):
 *   principal  — obrigatório. Sem ele não há IA: "sem chave, sem IA", nada de
 *                cair para uma chave global do servidor e jogar o custo da IA
 *                de terceiros no dono da máquina.
 *   secundaria — opcional. É a cota gratuita, e é por onde a cadeia COMEÇA.
 *   fallback   — opcional. Última tentativa (tipicamente Ollama local).
 */

import { kvStore, secrets } from '../db.js';
import { encryptSecret, decryptSecret, encryptionAvailable } from '../crypto.js';
import { getAdapter } from './adapters/index.js';

const SETTINGS_KEY = 'ai.settings';

export const SLOTS = ['principal', 'secundaria', 'fallback'];

export const SLOT_LABEL = {
  principal: 'Principal',
  secundaria: 'Secundária',
  fallback: 'Fallback',
};

/**
 * Nome do segredo de um slot. Ganha prefixo de usuário quando o middleware de
 * user_id existir; até lá o Hub é de um usuário só e o nome é direto.
 */
function secretName(slot) {
  return `ai.key.${slot}`;
}

function parseJson(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function emptySettings() {
  return { principal: null, secundaria: null, fallback: null };
}

/** Garante o formato de um slot vindo do banco. */
function normalizeSlot(slot) {
  if (!slot || typeof slot !== 'object') return null;
  const adapter = getAdapter(slot.provider);
  if (!adapter) return null;
  return {
    provider: adapter.id,
    model: typeof slot.model === 'string' && slot.model.trim() ? slot.model.trim() : adapter.defaultModel,
    baseUrl: adapter.needsBaseUrl
      ? (typeof slot.baseUrl === 'string' && slot.baseUrl.trim() ? slot.baseUrl.trim() : adapter.defaultBaseUrl)
      : null,
  };
}

/**
 * Migração das chaves da versão de um provedor só.
 *
 * A chave Gemini vivia em `ai.geminiApiKey` no kv_store, em claro — quer dizer,
 * era sincronizada para todo browser que abrisse o Hub. Aqui ela vira o slot
 * principal (provider gemini, para o Hub continuar funcionando sem intervenção),
 * muda para a tabela `secrets` cifrada, e o registro em claro é apagado.
 */
/**
 * Modelo Gemini a herdar da configuração antiga.
 *
 * Descarta a série 2.5 fixa: o Google a aposentou para contas novas em 19/08 e
 * toda chamada virou 404. A correção da época trocou o DEFAULT do código pelo
 * alias -latest, mas quem já tinha `gemini-2.5-*` gravado no kv_store continuou
 * com o valor morto — carregá-lo para o slot novo seria migrar o bug junto.
 * Alias não tem esse problema: é o Google quem o reaponta.
 */
function legacyGeminiModel() {
  const stored = parseJson(kvStore.get('ai.model'));
  if (typeof stored !== 'string' || /^gemini-2\.5-/.test(stored)) return null;
  return stored;
}

function migrateLegacy() {
  const legacyKey = parseJson(kvStore.get('ai.geminiApiKey'));
  const legacyProvider = parseJson(kvStore.get('hub.ai.provider'));
  if (!legacyKey && legacyProvider !== 'ollama') return null;

  const settings = emptySettings();

  if (legacyKey && typeof legacyKey === 'string' && legacyKey.trim()) {
    settings.principal = normalizeSlot({ provider: 'gemini', model: legacyGeminiModel() });
    secrets.set(secretName('principal'), encryptSecret(legacyKey.trim()));
  }
  if (legacyProvider === 'ollama') {
    const target = settings.principal ? 'fallback' : 'principal';
    settings[target] = normalizeSlot({ provider: 'ollama', model: parseJson(kvStore.get('hub.ai.ollamaModel')) });
  }

  kvStore.set(SETTINGS_KEY, JSON.stringify(settings));
  for (const key of ['ai.geminiApiKey', 'ai.model', 'ai.enabled', 'hub.ai.provider', 'hub.ai.ollamaModel']) {
    kvStore.delete(key);
  }
  console.log('[ai-settings] Configuração de IA migrada para os três slots; chave movida para a tabela secrets.');
  return settings;
}

/** Configuração bruta dos slots (sem as chaves). */
export function readSettings() {
  const stored = parseJson(kvStore.get(SETTINGS_KEY));
  if (stored) {
    const settings = emptySettings();
    for (const slot of SLOTS) settings[slot] = normalizeSlot(stored[slot]);
    return settings;
  }
  if (!encryptionAvailable()) {
    // Sem chave de cifragem não dá para mover o segredo legado para `secrets`,
    // e migrar pela metade deixaria a chave em claro no kv_store achando que
    // não está. Melhor não migrar e deixar o aviso de boot falar.
    return emptySettings();
  }
  return migrateLegacy() ?? emptySettings();
}

export function setSlotKey(slot, apiKey) {
  if (!SLOTS.includes(slot)) throw new Error(`Slot desconhecido: ${slot}`);
  secrets.set(secretName(slot), encryptSecret(String(apiKey).trim()));
}

export function clearSlotKey(slot) {
  secrets.delete(secretName(slot));
}

export function getSlotKey(slot) {
  return decryptSecret(secrets.get(secretName(slot)));
}

function hasSlotKey(slot) {
  return secrets.get(secretName(slot)) !== null;
}

/**
 * Slot pronto para uso: adaptador existente e, se o provedor exige chave, chave
 * guardada. Devolve já com a chave em claro — só o servidor chama isto.
 */
export function resolveSlot(slot, settings = readSettings()) {
  const config = settings[slot];
  if (!config) return null;
  const adapter = getAdapter(config.provider);
  if (!adapter) return null;

  let apiKey = null;
  if (adapter.needsKey) {
    apiKey = getSlotKey(slot);
    if (!apiKey) return null;
  }
  return { slot, adapter, apiKey, model: config.model, baseUrl: config.baseUrl };
}

/** Visão que vai para o browser: provedor, modelo e se há chave. Nunca a chave. */
export function publicSettings() {
  const settings = readSettings();
  const result = {};
  for (const slot of SLOTS) {
    result[slot] = settings[slot]
      ? { ...settings[slot], hasKey: hasSlotKey(slot) }
      : null;
  }
  return result;
}
