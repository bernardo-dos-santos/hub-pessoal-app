import { aiClient } from '../../../core/ai/aiClient';
import { MATH_TEXT_RULES } from '../../../core/ai/formatInstructions';
import type { Question } from '../types/question';

export const aiHintService = {
  async getHint(question: Question): Promise<string> {
    const options = question.options.map((o) => `${o.letter}) ${o.text}`).join('\n');
    const prompt = `Você é um tutor de concursos. Dê UMA dica para a questão abaixo sem revelar a resposta correta. A dica deve apontar o conceito ou raciocínio-chave para o aluno chegar à resposta sozinho. Responda em 1-2 frases, em português.

${MATH_TEXT_RULES}

Questão: ${question.statement}

Alternativas:
${options}

Dica (não revele a alternativa correta):`;
    return aiClient.complete(prompt);
  },
};
