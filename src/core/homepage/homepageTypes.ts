export type HomepageItem = {
  id: string;
  module: 'finance' | 'study' | 'college' | 'fitness' | 'goals' | 'planner' | 'concurso';
  score: number;
  zone: 'now' | 'progress' | 'next';
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'red' | 'yellow' | 'green' | 'blue' | 'muted';
  route?: string;
};

export interface RankedItems {
  now: HomepageItem[];
  progress: HomepageItem[];
  next: HomepageItem[];
}
