import { aiClient } from '../../../core/ai/aiClient';
import { MATH_JSON_RULES } from '../../../core/ai/formatInstructions';
import { getSubTopics } from '../data/subTopicTaxonomy';
import {
  type ExamStyle,
  type Question,
  type QuestionDifficulty,
  EXAM_STYLE_LABEL,
} from '../types/question';
import { type NewQuestion } from './questionService';

export type GenerateQuestionsInput = {
  sourceText: string;
  subjectTag: string;
  count: number;
  difficulty: QuestionDifficulty | 'mixed';
  examStyle: ExamStyle;
  contentId?: string;
};

// Shape cru que pedimos à IA (sem id/createdAt).
type RawQuestion = {
  statement: string;
  options: { letter: string; text: string }[];
  correctOption: string;
  explanation?: string;
  difficulty?: QuestionDifficulty;
  tags?: string[];
};

function buildPrompt(input: GenerateQuestionsInput): string {
  const styleLabel = EXAM_STYLE_LABEL[input.examStyle];
  const difficultyLine =
    input.difficulty === 'mixed'
      ? 'Varie a dificuldade entre fácil, médio e difícil.'
      : `Todas as questões devem ser de dificuldade "${input.difficulty}".`;

  return [
    `Você é um elaborador de questões de prova no estilo ${styleLabel}, em português do Brasil.`,
    `Com base no CONTEÚDO abaixo, crie ${input.count} questões de múltipla escolha sobre "${input.subjectTag}".`,
    '',
    'Regras:',
    '- Cada questão tem 5 alternativas (A a E), com exatamente uma correta.',
    '- O enunciado deve ser claro e cobrar entendimento, não decoreba trivial.',
    '- Inclua uma explicação curta do porquê a correta está certa.',
    `- ${difficultyLine}`,
    '- Use apenas informação derivável do conteúdo fornecido.',
    (() => {
      const subTopics = getSubTopics(input.subjectTag);
      return subTopics
        ? `- Marque de 1 a 3 tags de tópico por questão. Use APENAS tags desta lista canônica: [${subTopics.join(', ')}].`
        : '- Marque de 1 a 3 tags de tópico por questão (sub-tópicos específicos do conteúdo).';
    })(),
    '',
    MATH_JSON_RULES,
    '',
    'Formato de saída — APENAS o array JSON sem texto antes ou depois, cada item:',
    '{ "statement": string, "options": [{"letter":"A","text":string}, ... 5 itens], "correctOption": "A"|"B"|"C"|"D"|"E", "explanation": string, "difficulty": "easy"|"medium"|"hard", "tags": string[] }',
    '',
    'CONTEÚDO:',
    input.sourceText,
  ].join('\n');
}

/**
 * Fallback: se o modelo não usou LaTeX, converte os padrões mais comuns.
 * Só atua quando o texto não contém nenhum $ (modelo ignorou a instrução).
 */
function sanitizeText(text: string): string {
  if (text.includes('$')) return text; // modelo já usou LaTeX — não tocar

  return text
    // lim (x→0) ou lim (x->0) → $\lim_{x \to 0}$
    .replace(/lim\s*\(?\s*x\s*(?:→|->)\s*([^)\s,]{1,10})\s*\)?/g,
      (_m, a) => `$\\lim_{x \\to ${a.trim()}}$`)
    // x^2 ou x^{n-1} isolados → $x^{2}$ ou $x^{n-1}$
    .replace(/\b([a-zA-Z])\^(\d+)/g, (_m, v, e) => `$${v}^{${e}}$`)
    // ∞ solto → $\infty$
    .replace(/∞/g, '$\\infty$');
}

function isValidRaw(q: RawQuestion): boolean {
  return (
    typeof q.statement === 'string' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    typeof q.correctOption === 'string' &&
    q.options.some((o) => o.letter === q.correctOption)
  );
}

export const aiQuestionService = {
  async generateQuestions(input: GenerateQuestionsInput): Promise<NewQuestion[]> {
    const raw = await aiClient.completeJson<RawQuestion[]>(buildPrompt(input));
    if (!Array.isArray(raw)) {
      throw new Error('A IA não retornou uma lista de questões.');
    }

    const valid = raw.filter(isValidRaw);
    if (valid.length === 0) {
      throw new Error('Nenhuma questão válida foi gerada. Tente de novo ou ajuste o conteúdo.');
    }

    return valid.map((q) => ({
      contentId: input.contentId,
      subjectTag: input.subjectTag,
      statement: sanitizeText(q.statement.trim()),
      options: q.options.map((o) => ({
        letter: o.letter.trim().toUpperCase(),
        text: sanitizeText(o.text.trim()),
      })),
      correctOption: q.correctOption.trim().toUpperCase(),
      explanation: q.explanation ? sanitizeText(q.explanation.trim()) : undefined,
      difficulty: (q.difficulty ?? 'medium') as Question['difficulty'],
      examStyle: input.examStyle,
      tags: (q.tags ?? []).map((t) => t.trim()).filter(Boolean),
    }));
  },
};
