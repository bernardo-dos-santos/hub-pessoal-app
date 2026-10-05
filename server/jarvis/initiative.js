/**
 * jarvis/initiative.js — o tick proativo (Fase 2): o Jarvis olha o Hub sozinho
 * e decide, com julgamento do próprio modelo, se vale interromper Bernardo.
 *
 * Gate determinístico primeiro (barato, sem token) — só chama o modelo se
 * TODAS as condições passarem. Estado e histórico de decisões ficam em
 * jarvis.initiative.
 */

import { createHash } from 'node:crypto';
import { kvStore } from '../db.js';
import { kv, buildContext, buildContextPrompt } from './context.js';
import { runAgent } from './agent.js';
import { getTickTools } from './tools/index.js';
import { PERSONA_PROMPT, INITIATIVE_PROMPT } from './persona.js';
import { agentParamsFor, getJarvisConfig } from './config.js';

const RECENT_CHAT_WINDOW_MS = 30 * 60_000;
const MAX_LOG_ENTRIES = 100;

function loadState() {
  return kv('jarvis.initiative') ?? {
    lastTickAt: null,
    lastContextHash: null,
    budgetDate: null,
    budgetUsed: 0,
    log: [],
  };
}

function saveState(state) {
  kvStore.set('jarvis.initiative', JSON.stringify(state));
}

function logDecision(state, entry) {
  state.log = [{ at: new Date().toISOString(), ...entry }, ...(state.log ?? [])].slice(0, MAX_LOG_ENTRIES);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Campos puramente temporais (mudam todo tick sem significar nada mudou de
// verdade) ficam fora do hash — senão o gate 4 nunca barraria nada.
//
// `locationAt`/`locationAtLabel` entram nessa mesma categoria: o CARIMBO da
// leitura de GPS muda a cada envio do aparelho. O que fica no hash é
// `ctx.location.place`, que só muda quando ele troca de lugar de verdade — e é
// isso que faz "chegar em casa" liberar um tick sem nenhuma regra nova aqui.
function contextFingerprint(ctx) {
  const {
    timeStr, todayStr: _todayStr, weekDay, frontendCtx,
    locationAt, locationAtLabel,
    ...rest
  } = ctx;
  return rest;
}

function hashContext(ctx) {
  return createHash('sha256').update(JSON.stringify(contextFingerprint(ctx))).digest('hex');
}

function block(state, gate, reason) {
  logDecision(state, { gate, ran: false, reason });
  saveState(state);
  return { ran: false, gate, reason };
}

/**
 * Roda um tick. Retorna { ran: false, gate, reason } se o gate barrou, ou
 * { ran: true, ... } com o resultado da chamada ao modelo.
 */
export async function runInitiativeTick() {
  const config = getJarvisConfig();
  const { windowStart, windowEnd, dailyBudget } = config.tick;
  const state = loadState();
  const now = new Date();
  const dateKey = todayKey();

  if (state.budgetDate !== dateKey) {
    state.budgetDate = dateKey;
    state.budgetUsed = 0;
  }

  const hour = now.getHours();
  if (hour < windowStart || hour >= windowEnd) {
    return block(state, 'window', `fora da janela (${windowStart}h–${windowEnd}h), hora atual ${hour}h`);
  }

  if (state.budgetUsed >= dailyBudget) {
    return block(state, 'budget', `orçamento diário esgotado (${state.budgetUsed}/${dailyBudget})`);
  }

  const chatHistory = kv('jarvis.chatHistory') ?? [];
  const lastMsg = chatHistory[chatHistory.length - 1];
  if (lastMsg?.timestamp) {
    const sinceChat = now.getTime() - new Date(lastMsg.timestamp).getTime();
    if (sinceChat >= 0 && sinceChat < RECENT_CHAT_WINDOW_MS) {
      return block(state, 'recent_chat', `conversa há ${Math.round(sinceChat / 60_000)}min`);
    }
  }

  const ctx = buildContext();
  const hash = hashContext(ctx);
  const tracked = kv('jarvis.tracked') ?? [];
  const nowIso = now.toISOString();
  const dueTracked = tracked.filter((t) => t.status === 'active' && t.checkAfter <= nowIso);

  if (hash === state.lastContextHash && dueTracked.length === 0) {
    return block(state, 'unchanged', 'contexto inalterado desde o último tick e nenhum acompanhamento vencido');
  }

  // Passou o gate — a partir daqui gasta token.
  state.lastContextHash = hash;
  state.lastTickAt = nowIso;
  state.budgetUsed += 1;

  const contextPrompt = buildContextPrompt(ctx);
  const trackedNote = dueTracked.length > 0
    ? `\n\nACOMPANHAMENTOS VENCIDOS (você pediu pra olhar de novo a partir de agora): ${dueTracked.map((t) => `"${t.what}" (${t.why})`).join('; ')}`
    : '';

  const systemBlocks = [
    // Sem cache_control aqui de propósito, mas não pelo motivo original (que
    // era o intervalo de 90min contra o TTL de 5min). O cache das TOOLS do tick
    // já é decidido em getTickTools, que ancora quando o intervalo cabe na
    // janela de 1h. Aqui não vale: as tools renderizam ANTES do system, então
    // ancorar na persona só acrescentaria o bloco de persona ao que já está
    // coberto — e o bloco seguinte (contexto) muda a cada tick por definição,
    // então nada depois dele seria reaproveitado de qualquer forma.
    { type: 'text', text: PERSONA_PROMPT },
    { type: 'text', text: contextPrompt + trackedNote },
    { type: 'text', text: INITIATIVE_PROMPT },
  ];

  try {
    const result = await runAgent({
      ...agentParamsFor('tick', config),
      systemBlocks,
      messages: [{ role: 'user', content: '(tick automático — sem pergunta do Senhor. Decida com base no contexto acima.)' }],
      tools: getTickTools(config),
    });

    logDecision(state, { gate: 'passed', ran: true, text: result.text?.slice(0, 300) ?? null });
    saveState(state);
    return { ran: true, ...result };
  } catch (err) {
    logDecision(state, { gate: 'passed', ran: false, error: err.message });
    saveState(state);
    return { ran: false, gate: 'error', reason: err.message };
  }
}
