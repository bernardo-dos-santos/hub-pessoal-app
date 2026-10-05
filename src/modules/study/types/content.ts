export type StudyContent = {
  id: string;
  title: string;
  subjectTag: string;
  rawText?: string;
  sourceMaterialId?: string; // se veio de um material do College
  summary?: string; // resumo gerado por IA, se houver
  createdAt: string;
};
