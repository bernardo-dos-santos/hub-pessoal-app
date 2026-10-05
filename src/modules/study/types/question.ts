export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type ExamStyle = 'generico' | 'IBFC' | 'FEPESE' | 'CESPE' | 'faculdade';

export const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

export const EXAM_STYLE_LABEL: Record<ExamStyle, string> = {
  generico: 'Genérico',
  IBFC: 'IBFC',
  FEPESE: 'FEPESE',
  CESPE: 'CESPE/Cebraspe',
  faculdade: 'Prova de faculdade',
};

export type QuestionOption = {
  letter: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  text: string;
};

export type Question = {
  id: string;
  contentId?: string;
  materialIds?: string[]; // IDs dos materiais (PDFs) usados na geração
  subjectTag: string;
  statement: string;
  options: QuestionOption[];
  correctOption: string; // letra da alternativa correta
  explanation?: string;
  difficulty: QuestionDifficulty;
  examStyle?: ExamStyle;
  tags: string[];
  createdAt: string;
};
