/**
 * jarvis/budget.js — contabilidade de gasto das chamadas de modelo do Jarvis.
 *
 * Dado um modelo + o `usage` de uma resposta da API Anthropic, calcula o custo
 * e acumula no total do mês corrente em kv('jarvis.budget'). É o ponto único
 * por onde todo gasto passa — `runAgent` chama aqui depois de cada chamada.
 */

import { kvStore } from '../db.js';
import { getJarvisConfig } from './config.js';

// Preços por 1M tokens (verificado 2026-08-13). Cache read ≈0.1x o preço de
// input; cache write ≈1.25x o preço de input (TTL padrão de 5min).
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-haiku-4-5': { input: 1.00, output: 5.00 },
  'claude-sonnet-5': { input: 3.00, output: 15.00 },
  'claude-opus-5': { input: 5.00, output: 25.00 },
};

// Web search é cobrada por REQUISIÇÃO, não por token: US$ 10 por 1.000 buscas.
// Sem isso, uma fase de pesquisa pesada aparece como quase de graça no painel.
const WEB_SEARCH_USD_PER_REQUEST = 10 / 1000;

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function loadBudget() {
  const raw = kvStore.get('jarvis.budget');
  return (raw ? safeJson(raw) : null) ?? {};
}

/**
 * Total acumulado do mês. Devolve sempre um objeto completo (mesmo em mês novo)
 * para quem consome não precisar tratar ausência.
 */
export function getMonthSpend(key = monthKey()) {
  const entry = loadBudget()[key] ?? {};
  return {
    spentUsd: entry.spentUsd ?? 0,
    calls: entry.calls ?? 0,
    webSearches: entry.webSearches ?? 0,
  };
}

// ── Trava de gasto em 3 camadas ──────────────────────────────────────────────
/**
 * As três camadas são deliberadamente independentes, em ordem crescente de
 * confiabilidade e decrescente de antecedência:
 *
 *   1. SALDO BAIXO  — estimativa a partir do saldo digitado à mão. Avisa cedo,
 *      mas só vale se o saldo tiver sido atualizado na última recarga.
 *   2. TETO MENSAL  — comparação do gasto acumulado com o teto em R$. Trava
 *      tarefa autônoma; chat e tick seguem, porque travar o assistente inteiro
 *      por causa de um teto que você mesmo escolheu é pior que estourar ele.
 *   3. HTTP 402     — a API recusando. É a única que não depende de nenhuma
 *      estimativa estar certa, e por isso a última linha de defesa.
 */

const LOW_CREDIT_USD = 1;

export function getBudgetStatus(config = getJarvisConfig()) {
  const { spentUsd, calls, webSearches } = getMonthSpend();
  const { monthlyCapBrl, usdToBrl, creditUsd, creditUpdatedAt } = config.budget;

  const spentBrl = spentUsd * usdToBrl;
  const creditRemainingUsd = creditUsd === null ? null : creditUsd - spentUsd;

  return {
    month: monthKey(),
    spentUsd,
    spentBrl,
    calls,
    webSearches,
    monthlyCapBrl,
    usdToBrl,
    // Camada 2 — o gasto do mês bateu o teto configurado.
    capReached: monthlyCapBrl > 0 && spentBrl >= monthlyCapBrl,
    capUsedRatio: monthlyCapBrl > 0 ? spentBrl / monthlyCapBrl : 0,
    // Camada 1 — saldo digitado à mão, se houver.
    creditUsd,
    creditUpdatedAt,
    creditRemainingUsd,
    lowCredit: creditRemainingUsd !== null && creditRemainingUsd < LOW_CREDIT_USD,
  };
}

/**
 * Camada 2 aplicada: uma tarefa autônoma pode começar?
 * Só isto trava — chat e tick seguem de propósito.
 */
export function canStartAutonomousTask(config = getJarvisConfig()) {
  const status = getBudgetStatus(config);
  if (!status.capReached) return { allowed: true };
  return {
    allowed: false,
    reason: `Teto mensal atingido: R$ ${status.spentBrl.toFixed(2)} de R$ ${status.monthlyCapBrl.toFixed(2)}. `
      + 'Tarefas em background estão pausadas até o mês virar ou o teto ser aumentado nas configurações. '
      + 'Chat e verificações automáticas continuam funcionando.',
  };
}

/**
 * Registra o custo de uma chamada ao modelo no acumulado do mês corrente.
 *
 * Modelo fora da tabela de preços não é ignorado em silêncio: o gasto real
 * continua acontecendo, então some do total mas aparece no log. Contabilizar
 * como zero calado foi o que quase aconteceu quando o Opus entrou no plano.
 */
export function recordSpend({ model, usage }) {
  if (!usage) return;

  const pricing = PRICING[model];
  if (!pricing) {
    console.warn(`[jarvis][budget] modelo "${model}" fora da tabela de preços — gasto NÃO contabilizado.`);
    return;
  }

  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  const webSearches = usage.server_tool_use?.web_search_requests ?? 0;

  const cost =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output +
    (cacheReadTokens / 1_000_000) * (pricing.input * 0.1) +
    (cacheWriteTokens / 1_000_000) * (pricing.input * 1.25) +
    webSearches * WEB_SEARCH_USD_PER_REQUEST;

  const key = monthKey();
  const current = loadBudget();
  const entry = current[key] ?? { spentUsd: 0, calls: 0, webSearches: 0 };
  entry.spentUsd = (entry.spentUsd ?? 0) + cost;
  entry.calls = (entry.calls ?? 0) + 1;
  entry.webSearches = (entry.webSearches ?? 0) + webSearches;
  current[key] = entry;

  kvStore.set('jarvis.budget', JSON.stringify(current));
}
