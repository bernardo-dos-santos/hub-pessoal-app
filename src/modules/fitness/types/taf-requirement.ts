import { type WorkoutType } from './workout';

export type TafTestStatus = 'below' | 'close' | 'above';

export type TafRequirement = {
  id: string;
  testName: string;
  workoutType: WorkoutType;
  minimumValue: number;
  unit: string;
  higherIsBetter: boolean;
  gender?: 'male' | 'female';
  ageMin?: number;
  ageMax?: number;
};
