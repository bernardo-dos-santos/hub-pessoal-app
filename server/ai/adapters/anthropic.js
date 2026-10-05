/**
 * Adaptador Anthropic (Claude) — API /v1/messages.
 */

import { AiError, classifyProviderError } from '../aiError.js';

const BASE_URL = 'https://api.anthropic.com/v1';
const VERSION  = '2023-06-01';

export const anthropicAdapter = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  hint: 'Pago por uso · sem cota diária gratuita',
  needsKey: true,
  needsBaseUrl: false,
  keyUrl: 'https://console.anthropic.com/settings/keys',
  defaultModel: 'claude-haiku-4-5-20251001',
  suggestedModels: ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5'],

  async complete({ apiKey, model, prompt, system, temperature = 0.4, maxOutputTokens = 16000 }) {
    let res;
    try {
      res = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': VERSION,
        },
        body: JSON.stringify({
          model: model || this.defaultModel,
          max_tokens: maxOutputTokens,
          temperature,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      throw new AiError(`Falha de rede ao contatar a Anthropic: ${err.message}`, 'network', { provider: 'anthropic' });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error?.message ?? `Anthropic erro ${res.status}`;
      throw new AiError(message, classifyProviderError(res.status, message), { provider: 'anthropic', status: res.status });
    }

    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    if (!text.trim()) {
      // stop_reason diz por que veio vazio; max_tokens é o caso acionável.
      if (data.stop_reason === 'max_tokens') {
        throw new AiError(
          'A resposta atingiu o limite de tokens antes de escrever algo. Peça menos material de uma vez.',
          'empty',
          { provider: 'anthropic' },
        );
      }
      throw new AiError(`Anthropic retornou resposta vazia${data.stop_reason ? ` (motivo: ${data.stop_reason})` : ''}.`, 'empty', { provider: 'anthropic' });
    }
    return text;
  },

  /**
   * Lista os modelos que a chave aceita. Existe pelo mesmo motivo do botão
   * equivalente do Gemini: nome de modelo fixo no código vira 404 quando o
   * provedor aposenta a série, e a única fonte confiável é perguntar à chave.
   */
  async listModels({ apiKey }) {
    const res = await fetch(`${BASE_URL}/models?limit=100`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION },
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error?.message ?? `Anthropic erro ${res.status}`;
      throw new AiError(message, classifyProviderError(res.status, message), { provider: 'anthropic', status: res.status });
    }
    return (data.data ?? []).map((m) => m.id).filter(Boolean);
  },
};
