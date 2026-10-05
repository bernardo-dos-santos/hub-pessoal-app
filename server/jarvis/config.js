/**
 * jarvis/config.js — os dials de comportamento, capacidade e gasto do Jarvis.
 *
 * Ponto único de verdade: nenhum outro arquivo do Jarvis deve ter modelo,
 * intervalo, orçamento ou allowlist cravados. Tudo lê daqui em runtime, então
 * trocar de preset na tela vale na próxima chamada, sem reiniciar o servidor.
 *
 * O Hub vai ser multi-usuário e a frente correspondente já decidiu que cada
 * usuário traz a própria chave de IA — por isso o formato já nasce por-usuário
 * (uma chave `jarvis.config` que ganha `user_id` junto com o resto do kv_store
 * quando a migração acontecer), em vez de constante global.
 */

import { kvStore } from '../db.js';

const CONFIG_KEY = 'jarvis.config';

// ── Capacidades por modelo ───────────────────────────────────────────────────
/**
 * Nem todo modelo aceita todo parâmetro, e mandar um que ele não suporta é
 * erro 400, não degradação silenciosa. Haiku 4.5 é o caso que mais pega:
 * não aceita `effort` nem thinking adaptativo (ambos são 4.6+), e não suporta
 * as variantes _20260209 de web search/fetch.
 *
 * `toolSearch` é diferente dos outros: a API ACEITA a tool de busca no Haiku,
 * mas ele não a usa. Medido em 2026-08-13 com uma pergunta que só a
 * `get_taf_status` (diferida) responde — Sonnet 5 fez
 * `tool_search → tool_search_result → get_taf_status`, e o Haiku ignorou a
 * busca e chamou `get_weather`, uma tool carregada sem relação com a pergunta.
 * Ou seja: no Haiku, diferir tool não economiza, esconde. Por isso ele carrega
 * tudo — e é justamente onde carregar tudo custa menos (input a US$1/M).
 */
export const MODEL_CAPS = {
  'claude-haiku-4-5-20251001': { label: 'Haiku 4.5',  effort: false, adaptiveThinking: false, webToolsV2: false, toolSearch: false },
  'claude-sonnet-5':           { label: 'Sonnet 5',   effort: true,  adaptiveThinking: true,  webToolsV2: true,  toolSearch: true },
  'claude-opus-5':             { label: 'Opus 5',     effort: true,  adaptiveThinking: true,  webToolsV2: true,  toolSearch: true },
};

export function modelCaps(model) {
  return MODEL_CAPS[model] ?? { label: model, effort: false, adaptiveThinking: false, webToolsV2: false, toolSearch: false };
}

// ── Níveis de acesso à máquina ───────────────────────────────────────────────
/**
 * Eixo separado do preset de inteligência de propósito: inteligência custa
 * dinheiro, acesso custa risco. Alguém pode querer o modelo mais esperto com
 * acesso mínimo, ou o mais barato com acesso total.
 */
export const MACHINE_LEVELS = {
  0: { label: 'Nenhum',              hint: 'Sem agente. O Jarvis só mexe no próprio Hub.' },
  1: { label: 'Observar',            hint: 'Lê arquivos da pasta-sandbox, lista diretórios, tira screenshot. Não escreve nada.' },
  2: { label: 'Agir com confirmação', hint: 'Abre apps e URLs, controla mídia, escreve na sandbox. Qualquer outro comando espera você aprovar.' },
  3: { label: 'Allowlist livre',     hint: 'Comandos de leitura conhecidos rodam direto. O resto ainda pede aprovação.' },
  4: { label: 'Shell livre',         hint: 'Roda qualquer comando sem perguntar, inclusive apagar arquivos. Só na sua própria máquina.' },
};

// ── Presets ──────────────────────────────────────────────────────────────────
/**
 * Os três níveis do plano. Escolher um preenche todos os dials de uma vez;
 * mexer em qualquer dial depois move o preset para 'custom'.
 *
 * NOTA sobre o chat do Médio: o plano previa rotear entre Haiku (trivial) e
 * Sonnet (o resto), o que exigiria um classificador. Aqui o chat é um modelo
 * só, com `effort: low` fazendo o papel de contenção de custo. O roteamento
 * fica como otimização posterior — sem ele o Médio fica um pouco acima da
 * estimativa original.
 */
export const PRESETS = {
  basico: {
    chat: { model: 'claude-haiku-4-5-20251001', effort: null,     maxTokens: 1024, maxIters: 5 },
    tick: { model: 'claude-sonnet-5', effort: null, intervalMinutes: 90, dailyBudget: 4, windowStart: 7, windowEnd: 23, maxTokens: 512, maxIters: 5 },
    task: { model: 'claude-sonnet-5', effort: 'high',  maxIters: 20, maxTokens: 4096 },
    capabilities: { web: 'tasks', webMaxUses: 3, google: { read: true, write: false }, machine: { level: 2 }, memoryTool: false, location: false },
    budget: { monthlyCapBrl: 80 },
  },
  medio: {
    chat: { model: 'claude-sonnet-5', effort: 'low',   maxTokens: 2048, maxIters: 6 },
    tick: { model: 'claude-sonnet-5', effort: 'low', intervalMinutes: 45, dailyBudget: 6, windowStart: 7, windowEnd: 23, maxTokens: 512, maxIters: 5 },
    task: { model: 'claude-sonnet-5', effort: 'high',  maxIters: 20, maxTokens: 8192 },
    capabilities: { web: 'all', webMaxUses: 5, google: { read: true, write: true }, machine: { level: 2 }, memoryTool: true, location: true },
    budget: { monthlyCapBrl: 150 },
  },
  maximo: {
    chat: { model: 'claude-sonnet-5', effort: 'medium', maxTokens: 4096, maxIters: 8 },
    tick: { model: 'claude-sonnet-5', effort: 'low', intervalMinutes: 30, dailyBudget: 8, windowStart: 7, windowEnd: 23, maxTokens: 512, maxIters: 5 },
    task: { model: 'claude-opus-5',   effort: 'xhigh',  maxIters: 30, maxTokens: 16000 },
    capabilities: { web: 'all', webMaxUses: 8, google: { read: true, write: true }, machine: { level: 3 }, memoryTool: true, location: true },
    budget: { monthlyCapBrl: 300 },
  },
};

export const DEFAULT_PRESET = 'medio';

// Cotação usada para converter o gasto (que a API cobra em USD) no teto que
// Bernardo pensa em reais. É um dial porque câmbio muda.
const DEFAULT_USD_TO_BRL = 5.5;

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

/** Merge raso por seção — o suficiente para o formato de config abaixo. */
function mergeSection(base, override) {
  if (!override || typeof override !== 'object') return { ...base };
  return { ...base, ...override };
}

function mergeCapabilities(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base);
  return {
    web: override.web ?? base.web,
    // Teto de buscas por turno. Web search é cobrada por REQUISIÇÃO (US$ 10 por
    // 1.000), não por token — sem teto, uma pergunta ambígua vira dez buscas.
    webMaxUses: override.webMaxUses ?? base.webMaxUses ?? 5,
    google: mergeSection(base.google, override.google),
    machine: mergeSection(base.machine, override.machine),
    memoryTool: override.memoryTool ?? base.memoryTool,
    location: override.location ?? base.location ?? false,
  };
}

/**
 * Config efetiva: preset escolhido + overrides salvos por cima.
 * Nunca lança — config corrompida cai no preset padrão, porque o Jarvis parar
 * de responder por causa de um JSON quebrado é pior do que rodar no default.
 */
export function getJarvisConfig() {
  const stored = safeJson(kvStore.get(CONFIG_KEY)) ?? {};
  const presetName = PRESETS[stored.preset] ? stored.preset : DEFAULT_PRESET;
  const base = PRESETS[presetName];

  return {
    preset: stored.preset === 'custom' ? 'custom' : presetName,
    chat: mergeSection(base.chat, stored.chat),
    tick: mergeSection(base.tick, stored.tick),
    task: mergeSection(base.task, stored.task),
    capabilities: mergeCapabilities(base.capabilities, stored.capabilities),
    budget: {
      monthlyCapBrl: stored.budget?.monthlyCapBrl ?? base.budget.monthlyCapBrl,
      usdToBrl: stored.budget?.usdToBrl ?? DEFAULT_USD_TO_BRL,
      // Saldo de crédito digitado à mão: a Anthropic não expõe saldo por API.
      creditUsd: stored.budget?.creditUsd ?? null,
      creditUpdatedAt: stored.budget?.creditUpdatedAt ?? null,
    },
  };
}

/**
 * Aplica um patch nos dials.
 *
 * A sutileza que importa: `custom` não é um preset, então não tem base própria.
 * Se a config virasse `custom` guardando só o dial que o usuário tocou, todos
 * os outros seriam resolvidos contra o preset PADRÃO na leitura seguinte — e
 * quem estava no Básico e mexeu numa capacidade voltaria calado para os
 * modelos do Médio. Por isso a transição para `custom` MATERIALIZA a config
 * inteira: a partir daí ela não depende mais de nenhum preset.
 */
export function setJarvisConfig(patch) {
  const stored = safeJson(kvStore.get(CONFIG_KEY)) ?? {};
  const movingToCustom = patch.preset === 'custom' && stored.preset !== 'custom';
  const base = movingToCustom ? getJarvisConfig() : stored;

  const next = {
    preset: patch.preset ?? base.preset ?? DEFAULT_PRESET,
    chat: mergeSection(base.chat ?? {}, patch.chat),
    tick: mergeSection(base.tick ?? {}, patch.tick),
    task: mergeSection(base.task ?? {}, patch.task),
    capabilities: mergeCapabilities(base.capabilities ?? PRESETS[DEFAULT_PRESET].capabilities, patch.capabilities),
    budget: { ...(base.budget ?? {}), ...(patch.budget ?? {}) },
  };
  kvStore.set(CONFIG_KEY, JSON.stringify(next));
  return getJarvisConfig();
}

/**
 * Troca de preset: descarta os overrides e volta aos dials do preset.
 *
 * O teto mensal PERTENCE ao preset (é parte do que "Básico" significa), então
 * ele volta junto. Só sobrevivem os dados que são seus e não do nível: o
 * câmbio e o saldo de crédito digitado à mão — perder o saldo a cada troca de
 * preset obrigaria a redigitar algo que a API não devolve.
 */
export function applyPreset(presetName) {
  if (!PRESETS[presetName]) throw new Error(`Preset desconhecido: ${presetName}`);
  const stored = safeJson(kvStore.get(CONFIG_KEY)) ?? {};
  const kept = {};
  if (stored.budget?.usdToBrl !== undefined) kept.usdToBrl = stored.budget.usdToBrl;
  if (stored.budget?.creditUsd !== undefined) kept.creditUsd = stored.budget.creditUsd;
  if (stored.budget?.creditUpdatedAt !== undefined) kept.creditUpdatedAt = stored.budget.creditUpdatedAt;

  kvStore.set(CONFIG_KEY, JSON.stringify({ preset: presetName, budget: kept }));
  return getJarvisConfig();
}

/**
 * Monta os parâmetros de uma superfície ('chat' | 'tick' | 'task') já filtrados
 * pelo que o modelo aceita. É aqui que `effort` some quando o modelo é Haiku —
 * sem esse filtro a requisição volta 400.
 */
export function agentParamsFor(surface, config = getJarvisConfig()) {
  const dial = config[surface];
  if (!dial) throw new Error(`Superfície desconhecida: ${surface}`);
  // maxIters ausente faria o laço do runAgent não rodar nenhuma vez e estourar
  // "Limite de iterações atingido" — erro que não aponta para a causa. Melhor
  // falhar aqui, dizendo qual dial está incompleto.
  if (!dial.maxIters || !dial.maxTokens) {
    throw new Error(`Config do Jarvis incompleta para "${surface}": maxIters e maxTokens são obrigatórios.`);
  }
  const caps = modelCaps(dial.model);

  const params = {
    model: dial.model,
    maxTokens: dial.maxTokens,
    maxIters: dial.maxIters,
  };
  if (caps.adaptiveThinking && surface === 'task') params.thinking = { type: 'adaptive' };
  if (caps.effort && dial.effort) params.outputConfig = { effort: dial.effort };
  return params;
}

/** A web só entra no chat quando o modelo do chat suporta as variantes novas. */
export function webEnabledFor(surface, config = getJarvisConfig()) {
  const mode = config.capabilities.web;
  if (mode === 'off') return false;
  if (mode === 'tasks' && surface === 'chat') return false;
  return modelCaps(config[surface].model).webToolsV2;
}
