import { tafRequirements } from '../data/tafRequirements';
import { type TafRequirement, type TafTestStatus } from '../types/taf-requirement';
import { type WorkoutType } from '../types/workout';
import { workoutService } from './workoutService';

export type TafTestResult = {
  requirement: TafRequirement;
  bestValue: number | null;
  status: TafTestStatus | null;
  gap: number | null;
  lastDate: string | null;
};

export function getTafTestStatus(requirement: TafRequirement, value: number): TafTestStatus {
  const ratio = value / requirement.minimumValue;
  if (ratio >= 1.0) return 'above';
  if (ratio >= 0.9) return 'close';
  return 'below';
}

function getBestValue(workoutType: WorkoutType): number | null {
  const workouts = workoutService.listByType(workoutType);
  if (workouts.length === 0) return null;

  if (workoutType === 'running') {
    const distances = workouts.map((w) => w.distanceMeters ?? 0).filter((d) => d > 0);
    return distances.length > 0 ? Math.max(...distances) : null;
  }

  const reps = workouts.map((w) => w.reps ?? 0).filter((r) => r > 0);
  return reps.length > 0 ? Math.max(...reps) : null;
}

export const tafService = {
  getRequirements(): TafRequirement[] {
    return tafRequirements;
  },

  getAllTestResults(): TafTestResult[] {
    return tafRequirements.map((req) => {
      const bestValue = getBestValue(req.workoutType);
      const lastWorkout = workoutService.getLastByType(req.workoutType);
      const status = bestValue !== null ? getTafTestStatus(req, bestValue) : null;
      const gap = bestValue !== null && bestValue < req.minimumValue ? req.minimumValue - bestValue : null;
      return { requirement: req, bestValue, status, gap, lastDate: lastWorkout?.date ?? null };
    });
  },

  getMostCriticalTest(): TafTestResult | null {
    const below = this.getAllTestResults().filter((r) => r.status === 'below' || r.status === null);
    if (below.length === 0) return null;
    return below.sort((a, b) => {
      const ratioA = a.bestValue !== null ? a.bestValue / a.requirement.minimumValue : 0;
      const ratioB = b.bestValue !== null ? b.bestValue / b.requirement.minimumValue : 0;
      return ratioA - ratioB;
    })[0];
  },
};
