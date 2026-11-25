export declare const STUDY_ACTIVE_DAYS: number;
export declare const FITNESS_ACTIVE_DAYS: number;
export declare function isStudyPlanInUse(completions: Record<string, string> | null | undefined, today?: Date): boolean;
export declare function isTrainingInUse(daysSinceLastWorkout: number | null): boolean;
