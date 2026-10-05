/**
 * Adaptador Ollama — modelo local, sem chave e sem cota.
 *
 * A URL é resolvida A PARTIR DO SERVIDOR do Hub, não do aparelho que abriu a
 * tela: quem faz a chamada é o Express. No PC dedicado o Ollama não roda (i3 de
 * 9ª geração + RX 550, avaliado e descartado em ~06/2026), então apontar para
 * localhost:11434 ali não encontra nada — para usar o Ollama do notebook
 * (RTX 4060) o campo precisa receber a URL Tailscale do notebook.
 */

import { AiError } from '../aiError.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';

const trimUrl = (url) => (url || DEFAULT_BASE_URL).replace(/\/+$/, '');

export const ollamaAdapter = {
  id: 'ollama',
  label: 'Ollama (local)',
  hint: 'Grátis e sem limite · precisa estar rodando e alcançável pelo servidor',
  needsKey: false,
  needsBaseUrl: true,
  keyUrl: null,
  defaultModel: 'llama3.1:8b',
  defaultBaseUrl: DEFAULT_BASE_URL,
  suggestedModels: ['llama3.1:8b'],

  async complete({ baseUrl, model, prompt, system, temperature = 0.4 }) {
    let res;
    try {
      res = await fetch(`${trimUrl(baseUrl)}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || this.defaultModel,
          prompt,
          ...(system ? { system } : {}),
          stream: false,
          options: { temperature },
        }),
        signal: AbortSignal.timeout(180000), // modelo local é mais lento que nuvem
      });
    } catch (err) {
      throw new AiError(`Ollama inalcançável em ${trimUrl(baseUrl)}: ${err.message}`, 'network', { provider: 'ollama' });
    }

    if (!res.ok) throw new AiError(`Ollama retornou ${res.status}`, 'other', { provider: 'ollama', status: res.status });
    const data = await res.json().catch(() => ({}));
    const text = data.response ?? '';
    if (!text.trim()) throw new AiError('Ollama retornou resposta vazia.', 'empty', { provider: 'ollama' });
    return text;
  },

  /** Modelos instalados na instância. Serve também de teste de alcance. */
  async listModels({ baseUrl }) {
    let res;
    try {
      res = await fetch(`${trimUrl(baseUrl)}/api/tags`, { signal: AbortSignal.timeout(5000) });
    } catch (err) {
      throw new AiError(`Ollama inalcançável em ${trimUrl(baseUrl)}: ${err.message}`, 'network', { provider: 'ollama' });
    }
    if (!res.ok) throw new AiError(`Ollama retornou ${res.status}`, 'other', { provider: 'ollama', status: res.status });
    const data = await res.json().catch(() => ({}));
    return (data.models ?? []).map((m) => m.name).filter(Boolean);
  },
};
