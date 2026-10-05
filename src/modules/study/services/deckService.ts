import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { defaultFSRS, advance, isDue, migrateToFSRS, type Rating } from './spacedRepetitionService';
import { questionService } from './questionService';
import type { Deck, Flashcard, QuestCardState } from '../types/flashcard';

const DECK_KEY = 'study.decks';
const CARD_KEY = 'study.flashcards';
const QUEST_STATE_KEY = 'study.questCardStates';

// Migrate old SM-2 card to FSRS format silently on first read
function migrateCard(raw: Record<string, unknown>): Flashcard {
  if (typeof raw.stability === 'number') return raw as unknown as Flashcard;
  return {
    ...(raw as object),
    ...migrateToFSRS({
      repetitionCount: raw.repetitionCount as number | undefined,
      intervalDays: raw.intervalDays as number | undefined,
      nextReviewAt: raw.nextReviewAt as string,
    }),
  } as Flashcard;
}

function migrateQuestState(raw: Record<string, unknown>): QuestCardState {
  if (typeof raw.stability === 'number') return raw as unknown as QuestCardState;
  return {
    ...(raw as object),
    ...migrateToFSRS({
      repetitionCount: raw.repetitionCount as number | undefined,
      intervalDays: raw.intervalDays as number | undefined,
      nextReviewAt: raw.nextReviewAt as string,
    }),
  } as QuestCardState;
}

export const deckService = {
  // ── Decks ────────────────────────────────────────────────────────────────────

  listDecks(): Deck[] {
    return (storageAdapter.getItem<Deck[]>(DECK_KEY) ?? []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },

  createDeck(input: Pick<Deck, 'name' | 'subjectTag'>): Deck {
    const deck: Deck = { ...input, id: generateId(), createdAt: new Date().toISOString() };
    storageAdapter.setItem(DECK_KEY, [deck, ...this.listDecks()]);
    return deck;
  },

  deleteDeck(id: string): void {
    storageAdapter.setItem(DECK_KEY, this.listDecks().filter((d) => d.id !== id));
    storageAdapter.setItem(CARD_KEY, this.listAllCards().filter((c) => c.deckId !== id));
  },

  /** Remove todos os decks (e suas cartas) deste subjectTag. */
  removeBySubjectTag(tag: string): { decks: number; cards: number } {
    const decksToRemove = this.listDecks().filter((d) => d.subjectTag === tag);
    let cards = 0;
    for (const deck of decksToRemove) {
      cards += this.listCards(deck.id).length;
      this.deleteDeck(deck.id);
    }
    return { decks: decksToRemove.length, cards };
  },

  // ── Flashcards ───────────────────────────────────────────────────────────────

  listAllCards(): Flashcard[] {
    const raw = storageAdapter.getItem<Record<string, unknown>[]>(CARD_KEY) ?? [];
    return raw.map(migrateCard);
  },

  listCards(deckId: string): Flashcard[] {
    return this.listAllCards().filter((c) => c.deckId === deckId);
  },

  addCard(deckId: string, front: string, back: string): Flashcard {
    const card: Flashcard = {
      id: generateId(),
      deckId,
      front: front.trim(),
      back: back.trim(),
      ...defaultFSRS(),
      createdAt: new Date().toISOString(),
    };
    storageAdapter.setItem(CARD_KEY, [...this.listAllCards(), card]);
    return card;
  },

  deleteCard(id: string): void {
    storageAdapter.setItem(CARD_KEY, this.listAllCards().filter((c) => c.id !== id));
  },

  advanceCard(id: string, rating: Rating): void {
    const cards = this.listAllCards();
    const idx = cards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const updated = { ...cards[idx], ...advance(cards[idx], rating) };
    storageAdapter.setItem(
      CARD_KEY,
      cards.map((c, i) => (i === idx ? updated : c)),
    );
  },

  dueCards(deckId: string): Flashcard[] {
    return this.listCards(deckId).filter((c) => isDue(c.nextReviewAt));
  },

  /**
   * All due cards across every deck (shuffled) — used for interleaved sessions.
   * `excludeTags` é opcional e EXCLUSIVO — ver o comentário em
   * `errorNotebookService.listPending`, mesma razão.
   */
  dueCardsAllDecks(excludeTags?: Set<string>): Flashcard[] {
    const decksById = new Map(this.listDecks().map((d) => [d.id, d]));
    const due = this.listAllCards().filter(
      (c) => isDue(c.nextReviewAt) && !excludeTags?.has(decksById.get(c.deckId)?.subjectTag ?? ''),
    );
    for (let i = due.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [due[i], due[j]] = [due[j], due[i]];
    }
    return due;
  },

  // ── Quest Card States (FSRS for question bank) ───────────────────────────────

  listQuestCardStates(): QuestCardState[] {
    const raw = storageAdapter.getItem<Record<string, unknown>[]>(QUEST_STATE_KEY) ?? [];
    return raw.map(migrateQuestState);
  },

  /**
   * `excludeTags` opcional e EXCLUSIVO — mesma razão de `dueCardsAllDecks`.
   * Resolve subjectTag via um Map montado uma vez — `questionService.getById`
   * relê e reparseia o banco de questões inteiro a cada chamada; chamá-lo
   * dentro do filter (uma vez por estado FSRS) vira O(n²) à toa.
   */
  dueQuestionsCount(excludeTags?: Set<string>): number {
    const tagById = excludeTags
      ? new Map(questionService.listQuestions().map((q) => [q.id, q.subjectTag]))
      : null;
    return this.listQuestCardStates().filter((s) => {
      if (!isDue(s.nextReviewAt)) return false;
      if (!excludeTags || !tagById) return true;
      const tag = tagById.get(s.questionId);
      return !tag || !excludeTags.has(tag);
    }).length;
  },

  /** Remove os estados de repetição espaçada de questões que deixaram de existir. */
  removeQuestCardStatesFor(questionIds: string[]): number {
    if (questionIds.length === 0) return 0;
    const ids = new Set(questionIds);
    const states = this.listQuestCardStates();
    const kept = states.filter((s) => !ids.has(s.questionId));
    const removed = states.length - kept.length;
    if (removed > 0) storageAdapter.setItem(QUEST_STATE_KEY, kept);
    return removed;
  },

  advanceQuestCard(questionId: string, rating: Rating, answeredOption: string | null): void {
    const states = this.listQuestCardStates();
    const existing = states.find((s) => s.questionId === questionId);
    const base = existing ?? { questionId, ...defaultFSRS(), lastAnsweredOption: null };
    const next: QuestCardState = { ...base, ...advance(base, rating), lastAnsweredOption: answeredOption };
    storageAdapter.setItem(
      QUEST_STATE_KEY,
      existing
        ? states.map((s) => (s.questionId === questionId ? next : s))
        : [...states, next],
    );
  },
};
