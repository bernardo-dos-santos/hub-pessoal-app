/**
 * chain.js — o roteamento de custo entre os três slots.
 *
 * Ordem: Secundária → Principal → Fallback.
 *
 * Começar pela Secundária é o ponto todo: ela é a cota gratuita, e gastá-la
 * primeiro é o que impede que geração automática (SIGAA, briefing, plano
 * semanal) consuma a chave paga da Principal enquanto ainda havia cota de graça
 * sobrando. Cair para a Principal só quando o provedor SINALIZA que acabou —
 * e não quando alguma contabilidade nossa prevê que deve ter acabado — foi
 * decisão explícita: prever cota exigiria manter tabela de RPD por modelo (que
 * os provedores mudam sem avisar) e acertar o fuso do reset de cada um. Errar
 * qualquer um dos dois desliga a IA num dia em que ela ainda funcionava.
 */

import { AiError } from './aiError.js';
import { readSettings, resolveSlot, getSlotKey, SLOT_LABEL } from './aiSettings.js';
import { getAdapter } from './adapters/index.js';

/** Ordem de tentativa. Exportada para a tela de Configurações mostrar a mesma
 * sequência que o servidor executa, em vez de manter uma cópia da regra. */
export const CHAIN_ORDER = ['secundaria', 'principal', 'fallback'];

/**
 * Depois de um "cota esgotada", pular aquele slot por um tempo.
 *
 * Isto NÃO é previsão de cota: não sabemos nem tentamos saber quando ela volta.
 * É só não repetir uma pergunta que o provedor acabou de responder. Sem isso,
 * um job que processa 30 itens paga 30 round-trips para ouvir o mesmo 429 —
 * a tentativa-e-erro custaria mais que a economia que ela existe para gerar.
 * Vive em memória de propósito: reiniciou o servidor, tenta de novo.
 */
const QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
const cooldownUntil = new Map();

function inCooldown(slot) {
  const until = cooldownUntil.get(slot);
  return until !== undefined && until > Date.now();
}

function startCooldown(slot) {
  cooldownUntil.set(slot, Date.now() + QUOTA_COOLDOWN_MS);
}

/** Zera os cooldowns — a tela de Configurações chama ao salvar uma chave nova. */
export function clearCooldowns() {
  cooldownUntil.clear();
}

/**
 * Executa a cadeia e devolve o texto mais o slot que respondeu.
 * @param {string} prompt
 * @param {{ temperature?: number, system?: string, maxOutputTokens?: number }} [options]
 * @returns {Promise<{ text: string, slot: string, provider: string, model: string }>}
 */
export async function runChain(prompt, options = {}) {
  const settings = readSettings();

  // A Principal é obrigatória mesmo quando há outro slot que responderia.
  // "Sem chave, sem IA" é a regra inteira: um usuário que configurou só a
  // Secundária tem IA que funciona enquanto a cota gratuita durar e some sem
  // aviso quando ela acaba. Recusar aqui deixa o servidor de acordo com a tela,
  // que já esconde as funções de IA sem a Principal.
  if (!resolveSlot('principal', settings)) {
    throw new AiError(
      'A IA precisa de um slot Principal configurado. Vá em Configurações → Inteligência Artificial.',
      'unconfigured',
    );
  }

  const usable = CHAIN_ORDER.map((slot) => resolveSlot(slot, settings)).filter(Boolean);

  // Se TODOS estão em cooldown, tenta assim mesmo: ficar sem IA por causa de um
  // atalho de economia é pior do que gastar um round-trip a mais.
  let candidates = usable.filter((s) => !inCooldown(s.slot));
  if (candidates.length === 0) candidates = usable;

  let lastError = null;
  for (const { slot, adapter, apiKey, model, baseUrl } of candidates) {
    try {
      const text = await adapter.complete({
        apiKey,
        baseUrl,
        model,
        prompt,
        system: options.system,
        temperature: options.temperature ?? 0.4,
        maxOutputTokens: options.maxOutputTokens,
      });
      if (lastError) {
        console.log(`[ai] ${SLOT_LABEL[slot]} (${adapter.id}/${model}) respondeu depois da queda.`);
      }
      return { text, slot, provider: adapter.id, model };
    } catch (err) {
      lastError = err;
      const kind = err instanceof AiError ? err.kind : 'other';
      if (kind === 'quota') {
        startCooldown(slot);
        console.warn(`[ai] ${SLOT_LABEL[slot]} (${adapter.id}) sem cota → próximo slot. Motivo: ${err.message}`);
      } else {
        console.warn(`[ai] ${SLOT_LABEL[slot]} (${adapter.id}) falhou [${kind}] → próximo slot. Motivo: ${err.message}`);
      }
      // 'empty' é o provedor funcionando e recusando ESTE pedido (material grande
      // demais, filtro de segurança, recitação). A mensagem já diz o que fazer, e
      // repetir o mesmo pedido nos outros slots só troca essa mensagem útil pela
      // do último da fila — depois de pagar o tempo de todos.
      if (kind === 'empty') throw err;
    }
  }
  throw lastError;
}

/**
 * Resolve um slot para testar/listar, aceitando provedor e modelo vindos da
 * tela em vez dos que estão salvos.
 *
 * Existe porque a escrita de `ai.settings` pelo storageAdapter é write-through
 * assíncrona: testar logo depois de salvar correria com o PUT e leria a
 * configuração anterior. De quebra, deixa testar a combinação que está na tela
 * antes de gravá-la. A CHAVE nunca vem no corpo — essa continua sendo lida do
 * `secrets`, e portanto precisa ter sido salva antes.
 */
function resolveForRequest(slot, override) {
  if (!override?.provider) {
    const resolved = resolveSlot(slot);
    if (!resolved) throw new AiError(`Slot ${SLOT_LABEL[slot] ?? slot} não está configurado.`, 'unconfigured');
    return resolved;
  }
  const adapter = getAdapter(override.provider);
  if (!adapter) throw new AiError(`Provedor desconhecido: ${override.provider}`, 'unconfigured');

  let apiKey = null;
  if (adapter.needsKey) {
    apiKey = getSlotKey(slot);
    if (!apiKey) throw new AiError(`Salve a chave do slot ${SLOT_LABEL[slot] ?? slot} antes.`, 'unconfigured');
  }
  return {
    slot,
    adapter,
    apiKey,
    model: override.model || adapter.defaultModel,
    baseUrl: adapter.needsBaseUrl ? (override.baseUrl || adapter.defaultBaseUrl) : null,
  };
}

/** Testa um slot específico (botão "Testar" da tela de Configurações). */
export async function testSlot(slot, override) {
  const resolved = resolveForRequest(slot, override);
  const text = await resolved.adapter.complete({
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    model: resolved.model,
    prompt: 'Responda apenas: ok',
    temperature: 0,
    maxOutputTokens: 64,
  });
  clearCooldowns();
  return { ok: text.toLowerCase().includes('ok'), text: text.trim(), provider: resolved.adapter.id, model: resolved.model };
}

/** Modelos que a chave/instância daquele slot aceita de verdade. */
export async function listSlotModels(slot, override) {
  const resolved = resolveForRequest(slot, override);
  if (typeof resolved.adapter.listModels !== 'function') return resolved.adapter.suggestedModels ?? [];
  return resolved.adapter.listModels({ apiKey: resolved.apiKey, baseUrl: resolved.baseUrl });
}
