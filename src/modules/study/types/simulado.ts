export type SimuladoAnswer = {
  questionId: string;
  chosenOption: string | null; // null = "Não sei"
  status: 'correct' | 'wrong' | 'unknown';
  usedHint: boolean;
};

export type TagStat = {
  tag: string;
  correct: number;
  total: number;
};

export type Simulado = {
  id: string;
  title: string;
  questionIds: string[];
  durationMin: number;
  createdAt: string;
};

export type SimuladoResult = {
  id: string;
  simuladoId: string;
  title: string;
  answers: SimuladoAnswer[];
  score: number; // 0–100
  durationSpentSec: number;
  byTag: TagStat[];
  finishedAt: string;
};
