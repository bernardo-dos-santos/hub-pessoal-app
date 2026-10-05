import { apiUrl } from '../config/backendConfig';
import { type AiCompleteOptions } from './ai-types';

/**
 * Cliente de IA do frontend. Toda chamada vai para /api/ai/complete, e é o
 * servidor que resolve a cadeia Secundária → Principal → Fallback.
 *
 * Antes daqui saíam duas: o Gemini era chamado direto do browser com a chave
 * lida do storage, e havia uma segunda cadeia no servidor para os tiers do
 * Claude. Duas implementações da mesma regra de queda, uma delas exigindo a
 * chave no browser — o que deixava de funcionar assim que a chave passou a ser
 * cifrada no servidor, e que os jobs agendados nunca puderam usar.
 */

/** Extrai o primeiro bloco JSON de um texto (tolerante a ```json ... ``` e texto extra). */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = text.search(/[[{]/);
  if (firstBrace === -1) return text.trim();
  const lastBrace = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  return text.slice(firstBrace, lastBrace + 1).trim();
}

/**
 * Repara backslashes soltos dentro de strings JSON.
 * Os modelos frequentemente devolvem LaTeX com barra simples ($\frac{a}{b}$)
 * em vez da barra dupla exigida pelo JSON ($\\frac{a}{b}$), quebrando JSON.parse.
 * Esta função dobra qualquer `\` que não faça parte de um escape JSON válido.
 */
function repairJsonBackslashes(json: string): string {
  // Substitui \ não seguido de " \ / b f n r t u[0-9a-fA-F]{4}
  return json.replace(/\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
}

export const aiClient = {
  /** Completa um prompt e devolve o texto cru. */
  async complete(prompt: string, options?: AiCompleteOptions): Promise<string> {
    const res = await fetch(apiUrl('/api/ai/complete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        temperature: options?.temperature ?? 0.4,
        system: options?.system,
        maxOutputTokens: options?.maxOutputTokens,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Erro ${res.status} na IA.`);
    }
    const data = (await res.json()) as { text: string };
    return data.text;
  },

  /** Completa esperando JSON. Parse tolerante com 1 retry. */
  async completeJson<T>(prompt: string, options?: AiCompleteOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nResponda APENAS com JSON válido, sem texto antes ou depois, sem comentários.`;
    const opts: AiCompleteOptions = { temperature: 0.3, ...options };

    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.complete(jsonPrompt, opts);
      const extracted = extractJson(raw);
      try {
        return JSON.parse(extracted) as T;
      } catch {
        try {
          return JSON.parse(repairJsonBackslashes(extracted)) as T;
        } catch {
          console.warn(`[aiClient] JSON parse falhou (tentativa ${attempt + 1}):`, extracted.slice(0, 300));
        }
      }
    }
    throw new Error('A IA não retornou um JSON válido. Tente novamente.');
  },
};
