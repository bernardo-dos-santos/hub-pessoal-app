export type Deck = {
  id: string;
  name: string;
  subjectTag: string;
  createdAt: string;
};

export type Flashcard = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  // FSRS fields (always present after migration)
  stability: number;
  difficulty: number;
  repetitionCount: number;
  lastReviewedAt: string;
  nextReviewAt: string;
  // SM-2 legacy (may exist on cards created before FSRS migration)
  easeFactor?: number;
  intervalDays?: number;
  createdAt: string;
};

export type QuestCardState = {
  questionId: string;
  // FSRS fields (always present after migration)
  stability: number;
  difficulty: number;
  repetitionCount: number;
  lastReviewedAt: string;
  nextReviewAt: string;
  lastAnsweredOption: string | null;
  // SM-2 legacy
  easeFactor?: number;
  intervalDays?: number;
};
