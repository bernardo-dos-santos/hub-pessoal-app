/**
 * Adaptador Google Gemini — API generativelanguage v1beta.
 */

import { AiError, classifyProviderError } from '../aiError.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Alias, nao versao fixa.
 *
 * O Google aposenta modelo por conta: em 19/08 a serie 2.5 inteira passou a
 * responder 404 "no longer available to new users" para projetos criados
 * recentemente — e o Hub, que pedia gemini-2.5-flash-lite, parou de gerar
 * qualquer coisa sem que nada no codigo tivesse mudado. O sufixo -latest e
 * reapontado pelo proprio Google quando isso acontece.
 */
const DEFAULT_MODEL = 'gemini-flash-lite-latest';

export const geminiAdapter = {
  id: 'gemini',
  label: 'Google Gemini',
  hint: 'Cota diária gratuita no AI Studio',
  needsKey: true,
  needsBaseUrl: false,
  keyUrl: 'https://aistudio.google.com/app/apikey',
  defaultModel: DEFAULT_MODEL,
  // Aliases primeiro: versao fixa some sem aviso (a serie 2.5 virou 404 para
  // contas novas em 19/08). "Buscar modelos" lista o que a chave realmente
  // aceita, que e sempre a fonte confiavel.
  suggestedModels: ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-pro-latest'],

  async complete({ apiKey, model, prompt, system, temperature = 0.4, maxOutputTokens }) {
    const url = `${BASE_URL}/${model || DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          generationConfig: {
            temperature,
            ...(maxOutputTokens ? { maxOutputTokens } : {}),
          },
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      throw new AiError(`Falha de rede ao contatar o Gemini: ${err.message}`, 'network', { provider: 'gemini' });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error?.message ?? `Gemini erro ${res.status}`;
      throw new AiError(message, classifyProviderError(res.status, message), { provider: 'gemini', status: res.status });
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) {
      // HTTP 200 sem texto. O motivo está no finishReason (ou no blockReason,
      // quando o corte foi no prompt de entrada) — traduzir para algo acionável,
      // porque cada causa pede uma reação diferente do usuário.
      const finish  = data.candidates?.[0]?.finishReason;
      const blocked = data.promptFeedback?.blockReason;

      if (finish === 'MAX_TOKENS') {
        throw new AiError(
          'O material é grande demais para uma resposta só — a IA atingiu o limite de saída antes de escrever. '
          + 'Selecione menos materiais de uma vez, ou gere em formato de tópicos.',
          'empty', { provider: 'gemini' },
        );
      }
      if (finish === 'SAFETY' || blocked === 'SAFETY') {
        throw new AiError('A IA bloqueou a resposta por filtro de segurança. Tente reformular ou trocar o material.', 'empty', { provider: 'gemini' });
      }
      if (finish === 'RECITATION') {
        throw new AiError('A IA recusou por recitação (material muito próximo de texto protegido). Tente outro material.', 'empty', { provider: 'gemini' });
      }
      throw new AiError(`O Gemini retornou uma resposta vazia${finish ? ` (motivo: ${finish})` : ''}.`, 'empty', { provider: 'gemini' });
    }
    return text;
  },

  /** Modelos que esta chave suporta para generateContent (varia por chave/região). */
  async listModels({ apiKey }) {
    const res = await fetch(`${BASE_URL}?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(20000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error?.message ?? `Gemini erro ${res.status}`;
      throw new AiError(message, classifyProviderError(res.status, message), { provider: 'gemini', status: res.status });
    }
    return (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter((name) => name.includes('gemini'));
  },
};
