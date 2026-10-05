export type ErrorNotebookStatus = 'pending' | 'reviewing' | 'mastered';

export type ErrorNotebookEntry = {
  id: string;
  questionId: string;
  subjectTag: string;
  chosenOption: string | null;
  correctOption: string;
  reason: 'wrong' | 'unknown';
  usedHint: boolean;
  status: ErrorNotebookStatus;
  firstFailedAt: string;
  lastReviewedAt: string | null;
  timesFailed: number;
};
