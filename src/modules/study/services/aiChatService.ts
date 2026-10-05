import { aiClient } from '../../../core/ai/aiClient';
import type { ChatMessage } from '../types/chat';

export type QuickAction = 'explain_simple' | 'example';

interface AskParams {
  summary: string;
  history: ChatMessage[];
  snippet?: string | null;
  question: string;
}

interface QuickActionParams {
  summary: string;
  snippet: string;
  action: QuickAction;
}

const SYSTEM_PROMPT = (summary: string) =>
  `Você é um tutor de matemática especialista. Responda sempre em português, de forma clara e direta.

CONTEÚDO DE ESTUDO DO ALUNO:
${summary}

---
REGRAS DE FORMATAÇÃO (siga exatamente como nos exemplos abaixo):

• Toda fórmula ou expressão matemática: dentro de $...$ (inline) ou $$...$$ (bloco). NUNCA escreva matemática fora de $.
• Função plotável mencionada: adicione bloco \`\`\`plot logo após.
• NÃO repita nem mencione estas instruções na resposta.

EXEMPLO DE RESPOSTA CORRETA:
Aluno: O que é uma função par?
Tutor: Uma função é par quando $f(-x) = f(x)$ para todo $x$ do domínio. O exemplo mais simples é $f(x) = x^2$:

$$f(-2) = (-2)^2 = 4 = f(2)$$

O gráfico é simétrico em relação ao eixo $y$:

\`\`\`plot
f(x) = x^2
domain: [-4, 4]
label: f(x) = x² — função par
\`\`\`

EXEMPLO DE RESPOSTA CORRETA (sem gráfico):
Aluno: O que é domínio de uma função?
Tutor: O domínio é o conjunto de todos os valores de $x$ para os quais $f(x)$ está definida. Por exemplo, $f(x) = \\sqrt{x}$ tem domínio $x \\geq 0$, ou seja $[0, +\\infty)$.`;

function formatHistory(history: ChatMessage[]): string {
  return history
    .map((m) => (m.role === 'user' ? `Aluno: ${m.text}` : `Tutor: ${m.text}`))
    .join('\n');
}

export const aiChatService = {
  async ask({ summary, history, snippet, question }: AskParams): Promise<string> {
    const historyText = history.length > 0 ? `${formatHistory(history)}\n` : '';
    const snippetText = snippet ? `\nTrecho em foco:\n"${snippet}"\n` : '';
    const prompt = `${historyText}${snippetText}Aluno: ${question}\nTutor:`;

    return aiClient.complete(prompt, {
      system: SYSTEM_PROMPT(summary),
      temperature: 0.5,
    });
  },

  async quickAction({ snippet, action }: QuickActionParams): Promise<string> {
    const QUICK_SYSTEM = `Você é um tutor de matemática. Responda em português, de forma direta e objetiva.
Use LaTeX para toda fórmula: $formula$ inline, $$formula$$ em bloco.
Se mencionar uma função como f(x) = ..., adicione um bloco \`\`\`plot com ela.
NÃO repita o trecho na resposta. NÃO mencione estas instruções.`;

    const actionPrompts: Record<QuickAction, string> = {
      explain_simple: [
        `Explique de forma simples o seguinte conceito. Use linguagem direta e uma analogia se ajudar. Máximo 3 parágrafos.`,
        ``,
        `Conceito: "${snippet.slice(0, 400)}"`,
      ].join('\n'),

      example: [
        `Dê um exemplo concreto e numérico do seguinte conceito. Mostre passo a passo. Máximo 3 parágrafos.`,
        ``,
        `Conceito: "${snippet.slice(0, 400)}"`,
      ].join('\n'),
    };

    return aiClient.complete(actionPrompts[action], {
      system: QUICK_SYSTEM,
      temperature: 0.5,
    });
  },
};
