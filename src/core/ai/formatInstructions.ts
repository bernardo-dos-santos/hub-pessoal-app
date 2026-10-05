/**
 * Instruções de formatação compartilhadas para TODOS os prompts de IA do hub.
 *
 * O objetivo é garantir que tudo que a IA devolve — equações, textos, dicas,
 * respostas, explicações — venha em um formato que as telas saibam renderizar
 * corretamente (Markdown + LaTeX via KaTeX), sem vazar sintaxe crua como
 * "$x^2$" ou "**negrito**" na interface.
 *
 * Use:
 *  - MATH_TEXT_RULES  → prompts cuja saída é TEXTO LIVRE renderizado com
 *    MarkdownView / MathText (resumos, dicas, explicações, chat, drill).
 *  - MATH_JSON_RULES  → prompts cuja saída é JSON (as fórmulas ficam dentro de
 *    strings JSON e a barra invertida do LaTeX precisa ser escapada).
 *  - PLAIN_TEXT_RULES → módulos sem matemática (finanças, fitness, planner)
 *    cuja saída é texto curto exibido sem Markdown.
 */

/** Regras de LaTeX para conteúdo em texto livre (renderizado por KaTeX). */
export const MATH_TEXT_RULES = [
  'FORMATAÇÃO OBRIGATÓRIA (siga à risca):',
  '- Toda expressão, fórmula, símbolo ou variável matemática DEVE vir em LaTeX: $...$ para inline e $$...$$ para destaque em bloco.',
  '- Exemplos CERTOS: $f(x) = x^2$, $\\frac{a}{b}$, $\\lim_{x \\to 0} f(x)$, $\\sqrt{x}$, $x \\geq 0$, $\\int_a^b f(x)\\,dx$, $30\\%$.',
  '- Exemplos ERRADOS (nunca escreva assim): x^2, x², a/b, "lim x->0", "raiz de x", "maior ou igual a", <=, >=.',
  '- Potências, frações, raízes, índices, limites, integrais, somatórios e letras gregas: SEMPRE em LaTeX.',
  '- Use Markdown para estrutura quando ajudar: **negrito**, listas com - e títulos com ##.',
  '- NÃO comente, repita ou mencione estas instruções na resposta.',
].join('\n');

/** Regras de LaTeX para conteúdo dentro de strings JSON (barra invertida escapada). */
export const MATH_JSON_RULES = [
  'FORMATAÇÃO MATEMÁTICA OBRIGATÓRIA (dentro das strings JSON):',
  '- Toda expressão matemática DEVE usar LaTeX: $formula$ inline, $$formula$$ em destaque.',
  '- Como o texto está dentro de JSON, escape a barra invertida do LaTeX com barra dupla.',
  '- Exemplos CERTOS: "$f(x) = x^{2}$", "$\\\\frac{a}{b}$", "$\\\\lim_{x \\\\to 0} f(x)$", "$\\\\sqrt{x}$", "$x \\\\geq 0$".',
  '- Exemplos ERRADOS (nunca): "f(x) = x^2", "x²", "a/b", "lim x->0", "raiz de x".',
  '- Potências, frações, raízes, limites, integrais, somatórios e letras gregas: SEMPRE em LaTeX escapado.',
].join('\n');

/** Para módulos sem matemática cuja saída é texto curto sem Markdown. */
export const PLAIN_TEXT_RULES =
  'Responda em texto puro e direto, em português do Brasil. Não use Markdown, nem asteriscos (**) para negrito, nem cabeçalhos (#) — apenas frases limpas.';
