import { aiClient } from '../../../core/ai/aiClient';
import { MATH_JSON_RULES } from '../../../core/ai/formatInstructions';
import { type Question } from '../types/question';
import { type ErrorNotebookEntry } from '../types/errorNotebook';

export type DrillQuestion = {
  question: string;
  hint: string;
  answer: string; // para mostrar após o usuário responder
};

export type DrillEvaluation = {
  score: 'correct' | 'partial' | 'incorrect';
  feedback: string;
  shouldMarkMastered: boolean;
};

export const aiErrorDrillService = {
  /** Gera 3 perguntas de revisão baseadas no erro do caderno. */
  async generateDrillQuestions(entry: ErrorNotebookEntry, question: Question): Promise<DrillQuestion[]> {
    const options = question.options.map((o) => `${o.letter}) ${o.text}`).join('\n');
    const prompt = `Você é um tutor de concursos. Um aluno errou esta questão ${entry.timesFailed} vez(es) e precisa dominar o conteúdo.

Questão original:
${question.statement}

Alternativas:
${options}

Gabarito: ${question.correctOption}
Tag do assunto: ${question.subjectTag}

Gere 3 perguntas de revisão DIFERENTES (não a mesma questão) sobre o mesmo tema para testar o entendimento do aluno. As perguntas devem ir do conceito básico ao mais avançado.

${MATH_JSON_RULES}

Responda APENAS com JSON:
[
  { "question": "pergunta 1", "hint": "dica para pensar", "answer": "resposta esperada resumida" },
  { "question": "pergunta 2", "hint": "dica para pensar", "answer": "resposta esperada resumida" },
  { "question": "pergunta 3", "hint": "dica para pensar", "answer": "resposta esperada resumida" }
]`;

    const result = await aiClient.completeJson<DrillQuestion[]>(prompt);
    return Array.isArray(result) ? result.slice(0, 3) : [];
  },

  /** Avalia a resposta do aluno em texto livre. */
  async evaluateAnswer(
    drillQuestion: DrillQuestion,
    userAnswer: string,
  ): Promise<DrillEvaluation> {
    const prompt = `Avalie se a resposta do aluno está correta para esta pergunta de revisão.

Pergunta: ${drillQuestion.question}
Resposta esperada: ${drillQuestion.answer}
Resposta do aluno: ${userAnswer}

${MATH_JSON_RULES}

Responda APENAS com JSON:
{
  "score": "correct" | "partial" | "incorrect",
  "feedback": "feedback curto em 1-2 frases explicando o que acertou/errou",
  "shouldMarkMastered": true | false
}

shouldMarkMastered deve ser true apenas se o score for "correct" E a resposta demonstrar compreensão real.`;

    try {
      const result = await aiClient.completeJson<DrillEvaluation>(prompt);
      return {
        score: ['correct', 'partial', 'incorrect'].includes(result.score) ? result.score : 'incorrect',
        feedback: result.feedback ?? 'Resposta avaliada.',
        shouldMarkMastered: Boolean(result.shouldMarkMastered),
      };
    } catch {
      return {
        score: 'incorrect',
        feedback: 'Não foi possível avaliar automaticamente. Compare com a resposta esperada.',
        shouldMarkMastered: false,
      };
    }
  },
};
