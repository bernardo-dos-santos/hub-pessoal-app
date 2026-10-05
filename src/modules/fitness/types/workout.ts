export type WorkoutType = 'running' | 'sit_up' | 'push_up' | 'pull_up' | 'swimming' | 'strength' | 'other';

export type Workout = {
  id: string;
  type: WorkoutType;
  date: string;
  distanceMeters?: number;
  durationSeconds?: number;
  paceSecondsPerKm?: number;
  reps?: number;
  sets?: number;
  notes?: string;
  createdAt: string;
};
