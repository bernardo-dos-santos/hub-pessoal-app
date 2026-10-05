import { aiClient } from '../../../core/ai/aiClient';
import { MATH_TEXT_RULES } from '../../../core/ai/formatInstructions';
import type { Question } from '../types/question';

export const aiTutorService = {
  async explainError(question: Question, chosenOption: string | null): Promise<string> {
    const options = question.options.map((o) => `${o.letter}) ${o.text}`).join('\n');
    const chosen = chosenOption
      ? `O aluno escolheu a alternativa ${chosenOption}.`
      : 'O aluno marcou "Não sei".';

    const prompt = `Você é um tutor de concursos. Explique em 3-5 frases, em português, por que a resposta correta é a alternativa ${question.correctOption} e ${chosenOption ? `por que a alternativa ${chosenOption} está incorreta` : 'o que o aluno deveria ter pensado para chegar à resposta'}. Seja didático e direto.

${MATH_TEXT_RULES}

Questão: ${question.statement}

Alternativas:
${options}

Gabarito: ${question.correctOption}
${chosen}

Explicação:`;
    return aiClient.complete(prompt);
  },
};
