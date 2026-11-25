export type GoalCategory = 'financeiro' | 'saude' | 'pessoal' | 'faculdade';
export type GoalStatus = 'active' | 'completed' | 'abandoned';
export type KeyResultStatus = 'pending' | 'done';

export type KeyResult = {
  id: string;
  title: string;
  target?: string; // ex: "R$ 10 mil guardados"
  status: KeyResultStatus;
  completedAt?: string;
};

export type Goal = {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  status: GoalStatus;
  targetDate?: string;
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
};
