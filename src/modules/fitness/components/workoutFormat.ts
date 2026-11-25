import { type Workout, type WorkoutType } from '../types/workout';

/** How a workout reads on screen — shared by the summary and the history. */
export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  running: 'Corrida',
  sit_up: 'Abdominal',
  push_up: 'Flexão',
  pull_up: 'Barra',
  swimming: 'Natação',
  strength: 'Musculação',
  other: 'Outro',
};

export const WORKOUT_TYPE_EMOJI: Record<WorkoutType, string> = {
  running: '🏃',
  sit_up: '💪',
  push_up: '🤸',
  pull_up: '🏋️',
  swimming: '🏊',
  strength: '🏆',
  other: '⚡',
};

export function workoutValue(workout: Workout): string {
  if (workout.distanceMeters) {
    const dist = workout.distanceMeters >= 1000
      ? `${(workout.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`
      : `${workout.distanceMeters} m`;
    if (workout.durationSeconds) {
      const min = Math.floor(workout.durationSeconds / 60);
      const sec = (workout.durationSeconds % 60).toString().padStart(2, '0');
      return `${dist} · ${min}:${sec}`;
    }
    return dist;
  }
  if (workout.reps) {
    return workout.sets ? `${workout.sets}×${workout.reps} reps` : `${workout.reps} reps`;
  }
  return '—';
}

export function shortWorkoutDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
