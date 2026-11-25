import { aiClient } from '../../../core/ai/aiClient';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { workoutService } from './workoutService';

export type TrainingWeek = {
  weekNumber: number;
  focus: string;
  sessions: TrainingSession[];
};

export type TrainingSession = {
  day: string; // 'Segunda', 'Terça', etc.
  type: 'running' | 'strength' | 'sit_up' | 'push_up' | 'pull_up' | 'rest' | 'mixed';
  title: string;
  description: string;
  durationMinutes: number;
};

export type FitnessTrainingPlan = {
  generatedAt: string;
  totalWeeks: number;
  phase: string;
  objective: string;
  weeks: TrainingWeek[];
};

const STORAGE_KEY = 'fitness.trainingPlan';

export const aiFitnessPlannedService = {
  getCachedPlan(): FitnessTrainingPlan | null {
    return storageAdapter.getItem<FitnessTrainingPlan>(STORAGE_KEY);
  },

  savePlan(plan: FitnessTrainingPlan): void {
    storageAdapter.setItem(STORAGE_KEY, plan);
  },

  clearPlan(): void {
    storageAdapter.removeItem(STORAGE_KEY);
  },

  async generatePlan(): Promise<FitnessTrainingPlan> {
    const recentWorkouts = workoutService.listWorkouts().slice(0, 10);
    const phase = 'Base';
    const totalWeeks = 4;

    const workoutLines = recentWorkouts.length > 0
      ? recentWorkouts.map((w) => `- ${w.date}: ${w.type}${w.distanceMeters ? ` ${w.distanceMeters}m` : ''}${w.reps ? ` ${w.reps} reps` : ''}`).join('\n')
      : '- Sem histórico de treinos';

    const prompt = `Você é um preparador físico. Monte um plano de treino de ${totalWeeks} semanas para condicionamento geral (resistência aeróbica e força com peso corporal), adequado ao nível mostrado no histórico.

Histórico recente de treinos:
${workoutLines}

Retorne APENAS JSON no formato:
{
  "phase": "${phase}",
  "objective": "objetivo geral do plano em 1 frase",
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "foco da semana",
      "sessions": [
        {
          "day": "Segunda",
          "type": "running",
          "title": "título curto",
          "description": "descrição do treino com volumes e intensidades",
          "durationMinutes": 45
        }
      ]
    }
  ]
}

Inclua 3-5 sessões por semana com descanso adequado. Progrida a partir do que o histórico mostra, sem saltos bruscos de volume.`;

    const result = await aiClient.completeJson<{
      phase: string;
      objective: string;
      weeks: TrainingWeek[];
    }>(prompt);

    const plan: FitnessTrainingPlan = {
      generatedAt: new Date().toISOString(),
      totalWeeks,
      phase: result.phase ?? phase,
      objective: result.objective ?? 'Condicionamento geral',
      weeks: Array.isArray(result.weeks) ? result.weeks.slice(0, totalWeeks) : [],
    };

    this.savePlan(plan);
    return plan;
  },
};
