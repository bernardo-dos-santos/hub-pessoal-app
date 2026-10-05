import { updateDailyContext } from '../../../core/context/dailyContext';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type Workout, type WorkoutType } from '../types/workout';

const STORAGE_KEY = 'fitness.workouts';

export const workoutService = {
  listWorkouts(): Workout[] {
    return (storageAdapter.getItem<Workout[]>(STORAGE_KEY) ?? []).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  },

  listByType(type: WorkoutType): Workout[] {
    return this.listWorkouts().filter((w) => w.type === type);
  },

  getLastByType(type: WorkoutType): Workout | null {
    return this.listByType(type)[0] ?? null;
  },

  create(input: Omit<Workout, 'id' | 'createdAt'>): Workout {
    const workout: Workout = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    storageAdapter.setItem(STORAGE_KEY, [workout, ...this.listWorkouts()]);
    if (workout.date === new Date().toISOString().slice(0, 10)) {
      updateDailyContext({ fitness: { workedOutToday: true, todayWorkoutType: workout.type } });
    }
    return workout;
  },

  update(id: string, patch: Partial<Omit<Workout, 'id' | 'createdAt'>>): Workout | null {
    const all = this.listWorkouts();
    const index = all.findIndex((w) => w.id === id);
    if (index === -1) return null;
    const merged: Workout = { ...all[index], ...patch };
    // Recalcula o pace quando distância/tempo mudam.
    if (merged.distanceMeters && merged.durationSeconds) {
      merged.paceSecondsPerKm = Math.round(merged.durationSeconds / (merged.distanceMeters / 1000));
    }
    all[index] = merged;
    storageAdapter.setItem(STORAGE_KEY, all);
    return merged;
  },

  delete(id: string): void {
    storageAdapter.setItem(
      STORAGE_KEY,
      this.listWorkouts().filter((w) => w.id !== id),
    );
  },
};
