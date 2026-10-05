/**
 * aiError.js — erro de IA com causa classificada.
 *
 * A cadeia de slots (server/ai/chain.js) precisa distinguir "acabou a cota
 * deste provedor" de "a chave está errada" de "a rede caiu": todas caem para o
 * próximo slot, mas só a primeira é o caminho normal e barato que o roteamento
 * foi desenhado para explorar. Sem a classificação, o log de um dia inteiro de
 * queda para a Principal fica igual ao de uma chave digitada errada.
 */

/** @typedef {'quota' | 'auth' | 'empty' | 'network' | 'unconfigured' | 'other'} AiErrorKind */

export class AiError extends Error {
  /**
   * @param {string} message
   * @param {AiErrorKind} kind
   * @param {{ provider?: string, slot?: string, status?: number }} [meta]
   */
  constructor(message, kind = 'other', meta = {}) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    this.provider = meta.provider ?? null;
    this.slot = meta.slot ?? null;
    this.status = meta.status ?? null;
  }
}

/**
 * Classifica a resposta de erro de um provedor HTTP.
 *
 * A ordem das checagens importa: a mensagem é consultada antes do status
 * porque "credit balance is too low" da Anthropic chega como 400
 * invalid_request_error, não como 429. Ler só o status classificaria saldo
 * zerado como chave inválida — e a cadeia trataria "acabou o crédito" como
 * "o usuário digitou errado", que é o erro que já custou semanas de IA parada.
 *
 * @param {number} status
 * @param {string} message
 * @returns {'quota' | 'auth' | 'other'}
 */
export function classifyProviderError(status, message) {
  const lower = (message ?? '').toLowerCase();
  if (lower.includes('quota') || lower.includes('resource_exhausted')) return 'quota';
  if (lower.includes('rate limit') || lower.includes('rate_limit')) return 'quota';
  // Saldo acabado, nas frases que os dois provedores realmente usam:
  // "Your prepayment credits are depleted" (Gemini) e "Your credit balance is
  // too low" (Anthropic). Antes isto casava só por 'billing' aparecer na URL
  // que o Google anexa à mensagem — uma classificação que dependia de o Google
  // não mudar o texto do link.
  if (lower.includes('credit balance') || lower.includes('credits are depleted')) return 'quota';
  if (lower.includes('billing') || lower.includes('insufficient')) return 'quota';
  if (status === 429) return 'quota';
  // 400 entra aqui porque é o que o Gemini devolve para chave inválida. Os
  // casos de 400 por cota/saldo já saíram acima, pela mensagem.
  if (status === 400 || status === 401 || status === 403) return 'auth';
  return 'other';
}
