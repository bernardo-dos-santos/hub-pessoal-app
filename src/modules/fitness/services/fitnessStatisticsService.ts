import { workoutService } from './workoutService';

export const fitnessStatisticsService = {
  getDaysSinceLastWorkout(): number | null {
    const workouts = workoutService.listWorkouts();
    if (workouts.length === 0) return null;
    const last = new Date(workouts[0].date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  },

  getWorkoutsThisWeek(): number {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekKey = startOfWeek.toISOString().split('T')[0];
    return workoutService.listWorkouts().filter((w) => w.date >= weekKey).length;
  },
};
