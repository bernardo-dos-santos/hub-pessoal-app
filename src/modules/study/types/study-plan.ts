export type StudyPlanPriority = 'high' | 'medium' | 'low';

export type StudyPlanItem = {
  topic: string;
  allocatedMinutes: number;
  priority: StudyPlanPriority;
  reason: string;
  deadline: string | null;
};

export type StudyPlanMode = 'adaptive' | 'by_content' | 'by_grade';

export type StudyPlan = {
  id: string;
  mode: StudyPlanMode;
  title: string;
  items: StudyPlanItem[];
  generatedAt: string;
};
