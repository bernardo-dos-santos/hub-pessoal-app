/**
 * jarvis.js — assistente pessoal com tool calling (Fase 1).
 * Claude Haiku + tools de leitura/escrita no Hub.
 * Fallback para Gemini/Ollama sem ANTHROPIC_API_KEY.
 *
 * Thin facade over server/jarvis/* — see that directory for the actual
 * implementation (agent loop, persona, context builder, tools).
 */

import { callAi } from './aiProvider.js';
import { runAgent } from './jarvis/agent.js';
import { PERSONA_PROMPT, STYLE_REMINDER } from './jarvis/persona.js';
import { buildContext, buildContextPrompt } from './jarvis/context.js';
import { getJarvisTools } from './jarvis/tools/index.js';
import { agentParamsFor, getJarvisConfig } from './jarvis/config.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Conteúdo da mensagem no formato da API (Fase 13).
 *
 * Sem foto continua sendo string pura — não vale transformar toda mensagem num
 * array de blocos para o caso raro. Com foto, a IMAGEM VEM PRIMEIRO: a
 * documentação da Anthropic recomenda essa ordem, e na prática é o que faz o
 * modelo responder sobre a foto em vez de sobre o texto ao lado dela.
 */
function toApiContent(message) {
  if (!message.image) return message.content;
  return [
    {
      type: 'image',
      source: { type: 'base64', media_type: message.image.mediaType, data: message.image.data },
    },
    { type: 'text', text: message.content },
  ];
}

/**
 * @param {Array} messages
 * @param {{onTextDelta?: (delta: string) => void}} [opts] passar onTextDelta
 *   liga o streaming. O caminho de fallback (sem ANTHROPIC_KEY) não transmite:
 *   Gemini/Ollama aqui são texto puro, sem stream.
 */
export async function handleJarvisChat(messages, { onTextDelta } = {}) {
  const config = getJarvisConfig();
  const ctx = buildContext();
  const contextPrompt = buildContextPrompt(ctx);

  if (ANTHROPIC_KEY) {
    const systemBlocks = [
      // Bloco estático com breakpoint de cache (persona/regras/exemplos).
      // TTL de 1h porque conversa é em rajada: com os 5min padrão, o cache
      // expira entre uma mensagem e outra e cada turno paga uma gravação nova.
      { type: 'text', text: PERSONA_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: contextPrompt },
      // Por último de propósito — é o texto mais próximo da geração.
      { type: 'text', text: STYLE_REMINDER },
    ];
    const raw = messages.slice(-10).map((m) => ({ role: m.role, content: toApiContent(m) }));
    const firstUser = raw.findIndex((m) => m.role === 'user');
    const apiMessages = firstUser >= 0 ? raw.slice(firstUser) : raw;
    return await runAgent({
      ...agentParamsFor('chat'),
      systemBlocks,
      messages: apiMessages,
      tools: getJarvisTools(config),
      onTextDelta,
    });
  }

  // Fallback sem ANTHROPIC_KEY: texto puro via Gemini/Ollama
  const historyText = messages
    .slice(-6)
    // Gemini/Ollama aqui recebem texto puro. Anunciar a foto que não foi
    // enviada é melhor do que omitir: assim o modelo diz que não consegue ver,
    // em vez de responder com confiança sobre uma imagem inexistente.
    .map((m) => `${m.role === 'user' ? 'Bernardo' : 'JARVIS'}: ${m.content}`
      + (m.image ? ' [o Senhor anexou uma foto, que este modelo de fallback não consegue ver]' : ''))
    .join('\n');
  // 0.7: com persona irônica, 0.5 deixava as respostas sem graça e repetitivas.
  const text = await callAi(`${PERSONA_PROMPT}\n\n${contextPrompt}\n\nConversa:\n${historyText}`, { temperature: 0.7 });
  return { text, affectedKeys: [] };
}
