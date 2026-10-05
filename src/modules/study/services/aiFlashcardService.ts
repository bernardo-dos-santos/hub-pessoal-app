import { aiClient } from '../../../core/ai/aiClient';
import { MATH_JSON_RULES } from '../../../core/ai/formatInstructions';

export type RawFlashcard = { front: string; back: string };

export const aiFlashcardService = {
  async generateFlashcards({
    sourceText,
    subjectTag,
    count = 10,
  }: {
    sourceText: string;
    subjectTag: string;
    count?: number;
  }): Promise<RawFlashcard[]> {
    const prompt = `Você é um professor especialista em ${subjectTag}.
A partir do texto abaixo, crie ${count} flashcards de estudo no formato frente/verso.
Cada flashcard deve cobrir um conceito importante, definição, sigla ou relação do conteúdo.
- Frente: pergunta curta, termo ou conceito (máx. 1 frase)
- Verso: resposta direta e concisa (máx. 2 frases)

${MATH_JSON_RULES}

Texto:
${sourceText}

Responda com um array JSON:
[{"front": "...", "back": "..."}, ...]`;

    const cards = await aiClient.completeJson<RawFlashcard[]>(prompt);
    if (!Array.isArray(cards)) throw new Error('Resposta inválida da IA.');
    return cards
      .filter((c) => c && typeof c.front === 'string' && typeof c.back === 'string')
      .slice(0, count);
  },
};
