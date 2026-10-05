// FSRS-5 spaced repetition algorithm (replaces SM-2).
// Trained on 700M+ reviews; 20-30% fewer reviews than SM-2 for same retention.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki

export type Rating = 'forgot' | 'good' | 'easy';

export type FSRSFields = {
  stability: number;     // days until recall drops from 100% to 90%
  difficulty: number;    // 1-10, intrinsic difficulty of this card
  repetitionCount: number;
  nextReviewAt: string;
  lastReviewedAt: string;
};

// Kept for migration reference (old SM-2 cards stored in localStorage)
export type SM2Fields = {
  repetitionCount: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
};

// FSRS-5 default weights (pre-trained on 700M+ Anki reviews)
const W = [
  0.40255, 1.18385, 3.1262, 15.4722, // initial stability per rating (Again/Hard/Good/Easy)
  7.2102,  0.5316,                     // initial difficulty
  1.0651,  0.0589,                     // difficulty update
  1.5330,  0.1544, 1.0040,            // stability after recall
  1.9395,  0.11,   0.29605, 2.2698,   // stability after forget
  0.2315,  2.9898, 0.51,              // misc (hard penalty, easy bonus, short-term)
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // ≈ 0.2346 — for R(t,S) = (1 + FACTOR*t/S)^DECAY

// Maps our 3-level rating to FSRS 1/3/4 (skipping "Hard" = 2)
function fsrsRating(r: Rating): 1 | 3 | 4 {
  if (r === 'forgot') return 1;
  if (r === 'good') return 3;
  return 4;
}

function clampD(d: number): number {
  return Math.min(Math.max(d, 1), 10);
}

// Probability of recall after t days given stability S
function retrievability(t: number, stability: number): number {
  return Math.pow(1 + (FACTOR * t) / Math.max(stability, 0.01), DECAY);
}

function initialStability(rating: Rating): number {
  return Math.max(W[fsrsRating(rating) - 1], 0.1);
}

function initialDifficulty(rating: Rating): number {
  const r = fsrsRating(rating);
  return clampD(W[4] - Math.exp(W[5] * (r - 1)) + 1);
}

function nextDifficulty(d: number, rating: Rating): number {
  const r = fsrsRating(rating);
  const updated = d - W[6] * (r - 3);
  // Mean reversion toward initial difficulty (prevents extremes)
  return clampD(W[7] * W[4] + (1 - W[7]) * updated);
}

function stabilityAfterRecall(s: number, d: number, r: number, rating: Rating): number {
  const easyBonus = rating === 'easy' ? W[16] : 1;
  return Math.max(
    s * (Math.exp(W[8]) * (11 - d) * Math.pow(Math.max(s, 0.1), -W[9])
      * (Math.exp((1 - r) * W[10]) - 1) * easyBonus) + 1,
    0.1,
  );
}

function stabilityAfterForget(s: number, d: number, r: number): number {
  return Math.max(
    W[11] * Math.pow(Math.max(d, 1), -W[12])
    * (Math.pow(s + 1, W[13]) - 1)
    * Math.exp((1 - r) * W[14]),
    0.1,
  );
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function defaultFSRS(): FSRSFields {
  const now = new Date().toISOString();
  return { stability: 0, difficulty: 5, repetitionCount: 0, nextReviewAt: now, lastReviewedAt: now };
}

export function advance(fields: FSRSFields, rating: Rating): FSRSFields {
  const now = new Date();
  const lastReviewed = new Date(fields.lastReviewedAt);
  const t = Math.max((now.getTime() - lastReviewed.getTime()) / 86_400_000, 0.001);

  let stability: number;
  let difficulty: number;

  if (fields.repetitionCount === 0) {
    stability = initialStability(rating);
    difficulty = initialDifficulty(rating);
  } else {
    const s = Math.max(fields.stability, 0.1);
    const d = fields.difficulty;
    const r = retrievability(t, s);
    difficulty = nextDifficulty(d, rating);
    stability = rating === 'forgot'
      ? stabilityAfterForget(s, d, r)
      : stabilityAfterRecall(s, d, r, rating);
  }

  // next_interval = stability (for target retention 0.9, derivation: t = S exactly)
  const intervalDays = Math.max(Math.round(stability), 1);

  return {
    stability,
    difficulty,
    repetitionCount: fields.repetitionCount + 1,
    nextReviewAt: addDays(intervalDays),
    lastReviewedAt: now.toISOString(),
  };
}

export function isDue(nextReviewAt: string): boolean {
  return new Date(nextReviewAt) <= new Date();
}

// Migration helper: estimate FSRS fields from old SM-2 card data
export function migrateToFSRS(raw: {
  repetitionCount?: number;
  intervalDays?: number;
  nextReviewAt: string;
}): FSRSFields {
  const intervalDays = (raw.intervalDays ?? 1);
  return {
    stability: Math.max(intervalDays, 1),
    difficulty: 5,
    repetitionCount: raw.repetitionCount ?? 0,
    nextReviewAt: raw.nextReviewAt,
    lastReviewedAt: raw.nextReviewAt,
  };
}

// Legacy SM-2 default — kept only as migration reference
export function defaultSM2(): SM2Fields {
  return { repetitionCount: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: new Date().toISOString() };
}
