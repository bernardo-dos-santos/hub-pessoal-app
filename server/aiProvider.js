/**
 * aiProvider.js — a única porta de entrada de IA do lado do servidor.
 *
 * Uso:
 *   import { callAi } from './aiProvider.js';
 *   const text = await callAi(prompt, { temperature: 0.4 });
 *
 * Não recebe mais chave por parâmetro. As credenciais são as do usuário,
 * guardadas cifradas (server/ai/aiSettings.js), e a ordem de tentativa é a
 * cadeia Secundária → Principal → Fallback (server/ai/chain.js).
 *
 * O que existia antes aqui e por que saiu:
 *
 * - `apiKey` como argumento e `process.env.GEMINI_API_KEY` como rede de
 *   segurança. Com o Hub virando multiusuário, essa rede significava a IA de
 *   qualquer pessoa rodando na chave do dono do servidor. A regra passou a ser
 *   "sem chave, sem IA".
 *
 * - `callAiTiered` e os tiers 'complex'/'standard', que punham Claude Sonnet ou
 *   Haiku na frente usando ANTHROPIC_API_KEY do ambiente. Mesmo motivo: era
 *   custo do dono do servidor. Quem quiser Claude põe a própria chave num slot.
 *   O Jarvis continua com a chave da Anthropic do servidor — ele é o assistente
 *   do dono da máquina, não um recurso compartilhado dos módulos.
 *
 * - O Ollama por OLLAMA_URL de ambiente. Virou slot configurável, com URL por
 *   configuração, porque quem alcança o Ollama é o servidor e nem sempre ele
 *   está na mesma máquina (no PC dedicado o Ollama não roda).
 */

import { runChain } from './ai/chain.js';

export { runChain };

/**
 * Chama a IA pela cadeia de slots do usuário.
 * @param {string} prompt
 * @param {{ temperature?: number, system?: string, maxOutputTokens?: number }} [options]
 * @returns {Promise<string>} texto da resposta
 */
export async function callAi(prompt, options = {}) {
  const { text } = await runChain(prompt, options);
  return text;
}
