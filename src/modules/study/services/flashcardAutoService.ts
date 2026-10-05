import { storageAdapter } from '../../../core/storage/storage.adapter';
import { deckService } from './deckService';
import type { Question } from '../types/question';

// Tracks which question IDs contributed to each sub-topic's error count.
// Each question counts at most once per tag — prevents one hard question from
// inflating the count on repeated wrong answers.
const TOPIC_QUESTIONS_KEY = 'study.flashcardAuto.topicQuestions'; // Record<tag, string[]>
const PROMOTED_KEY        = 'study.flashcardAuto.promoted';        // questionId[] already converted
const WRONG_THRESHOLD     = 3;

// Legacy key — kept for read-only migration on first access
const LEGACY_COUNTS_KEY = 'study.flashcardAuto.topicCounts';

function getTopicQuestions(): Record<string, string[]> {
  const stored = storageAdapter.getItem<Record<string, string[]>>(TOPIC_QUESTIONS_KEY);
  if (stored) return stored;

  // One-time migration from legacy numeric counts: treat existing counts as
  // anonymous question IDs so the threshold is preserved without data loss.
  const legacy = storageAdapter.getItem<Record<string, number>>(LEGACY_COUNTS_KEY);
  if (legacy) {
    const migrated: Record<string, string[]> = {};
    for (const [tag, count] of Object.entries(legacy)) {
      migrated[tag] = Array.from({ length: count }, (_, i) => `__legacy_${tag}_${i}`);
    }
    storageAdapter.setItem(TOPIC_QUESTIONS_KEY, migrated);
    return migrated;
  }

  return {};
}

function saveTopicQuestions(map: Record<string, string[]>): void {
  storageAdapter.setItem(TOPIC_QUESTIONS_KEY, map);
}

function getPromoted(): Set<string> {
  return new Set(storageAdapter.getItem<string[]>(PROMOTED_KEY) ?? []);
}

function markPromoted(questionId: string): void {
  const set = getPromoted();
  set.add(questionId);
  storageAdapter.setItem(PROMOTED_KEY, [...set]);
}

function findOrCreateAutoDeck(subjectTag: string): string {
  const name = `Auto — ${subjectTag}`;
  const existing = deckService.listDecks().find((d) => d.name === name);
  return existing ? existing.id : deckService.createDeck({ name, subjectTag }).id;
}

export const flashcardAutoService = {
  /**
   * Records a wrong answer. Each question contributes at most once per tag —
   * getting the same question wrong multiple times does not inflate the count.
   * When any tag reaches WRONG_THRESHOLD distinct questions, the triggering
   * question is promoted to a flashcard in "Auto — [disciplina]".
   * Returns subjectTag if a flashcard was created, null otherwise.
   */
  recordWrong(question: Question): string | null {
    const effectiveTags = question.tags.length > 0 ? question.tags : [question.subjectTag];
    const map = getTopicQuestions();
    let crossed = false;

    for (const tag of effectiveTags) {
      const existing = map[tag] ?? [];
      // Only count this question once per tag
      if (existing.includes(question.id)) continue;
      const updated = [...existing, question.id];
      map[tag] = updated;
      if (updated.length >= WRONG_THRESHOLD) crossed = true;
    }
    saveTopicQuestions(map);

    if (!crossed) return null;

    const promoted = getPromoted();
    if (promoted.has(question.id)) return null;

    const correct = question.options.find((o) => o.letter === question.correctOption);
    const front = question.statement.trim();
    const back = [
      correct ? `${correct.letter}) ${correct.text}` : question.correctOption,
      question.explanation ? `\n\n${question.explanation.trim()}` : '',
    ].join('').trim();

    const deckId = findOrCreateAutoDeck(question.subjectTag);
    deckService.addCard(deckId, front, back);
    markPromoted(question.id);
    return question.subjectTag;
  },

  getTopicWrongCount(tag: string): number {
    return (getTopicQuestions()[tag] ?? []).length;
  },
};
