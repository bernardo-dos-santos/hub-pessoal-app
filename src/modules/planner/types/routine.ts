export type WeekDay = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export const WEEK_DAYS: WeekDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const WEEK_DAY_LABEL: Record<WeekDay, string> = {
  sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado',
};

export const WEEK_DAY_SHORT: Record<WeekDay, string> = {
  sunday: 'Dom', monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb',
};

export type ActivityType =
  | 'free'
  | 'study'
  | 'college'
  | 'gym'
  | 'work'
  | 'meal'
  | 'commute'
  | 'rest'
  | 'personal';

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  free: 'Livre',
  study: 'Estudo',
  college: 'Faculdade',
  gym: 'Treino',
  work: 'Trabalho',
  meal: 'Refeição',
  commute: 'Deslocamento',
  rest: 'Descanso',
  personal: 'Pessoal',
};

/** Tipos que o plano semanal pode preencher com sessões. */
export const PLANNABLE_ACTIVITIES = new Set<ActivityType>(['free', 'study']);

export type TimeBlock = { start: string; end: string; activity?: ActivityType };

export type DayRoutine = {
  day: WeekDay;
  available: boolean;
  blocks: TimeBlock[];
  commitment: string;
  wakeTime?: string;
  sleepTime?: string;
};

export type Routine = {
  days: DayRoutine[];
  updatedAt: string;
};

export type SessionType = 'study' | 'review' | 'train' | 'rest' | 'admin' | 'other';

export type WeeklySession = {
  id: string;
  day: WeekDay;
  startTime: string;
  type: SessionType;
  topic: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
};

export type StudyBreakdownItem = {
  subtopic: string;
  durationMinutes: number;
  instruction: string;
};

export type WeeklyPlan = {
  id: string;
  weekOf: string;
  sessions: WeeklySession[];
  generatedAt: string;
  source: 'manual' | 'auto_sunday';
};
