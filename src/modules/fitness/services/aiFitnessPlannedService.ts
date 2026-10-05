import { aiClient } from '../../../core/ai/aiClient';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { tafService } from './tafService';
import { workoutService } from './workoutService';
import { concursoService } from '../../../core/concurso/concursoService';

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
    const tafResults = tafService.getAllTestResults();
    const daysUntilExam = concursoService.getDaysUntilExam();
    const recentWorkouts = workoutService.listWorkouts().slice(0, 10);

    // Determina fase baseada nos dias até a prova
    let phase = 'Base';
    let totalWeeks = 4;
    if (daysUntilExam !== null) {
      if (daysUntilExam > 90) { phase = 'Base'; totalWeeks = 6; }
      else if (daysUntilExam > 30) { phase = 'Específica'; totalWeeks = 4; }
      else { phase = 'Pico'; totalWeeks = 2; }
    }

    const tafLines = tafResults.map((r) => {
      const pct = r.bestValue !== null
        ? Math.round((r.bestValue / r.requirement.minimumValue) * 100)
        : 0;
      const gap = r.gap !== null ? ` (falta ${r.gap} ${r.requirement.unit})` : '';
      return `- ${r.requirement.testName}: ${r.bestValue ?? 'sem dado'} ${r.requirement.unit} / mínimo ${r.requirement.minimumValue} ${r.requirement.unit} — ${pct}%${gap}`;
    }).join('\n');

    const workoutLines = recentWorkouts.length > 0
      ? recentWorkouts.map((w) => `- ${w.date}: ${w.type}${w.distanceMeters ? ` ${w.distanceMeters}m` : ''}${w.reps ? ` ${w.reps} reps` : ''}`).join('\n')
      : '- Sem histórico de treinos';

    const examLine = daysUntilExam !== null
      ? `Dias até a prova: ${daysUntilExam} (fase: ${phase})`
      : 'Data da prova não configurada (usar fase Base padrão)';

    const prompt = `Você é um preparador físico especializado em concursos militares (Bombeiro Militar SC - CBMSC).

Monte um plano de treino de ${totalWeeks} semanas na fase ${phase} para um candidato ao CBMSC.

Teste de Aptidão Física (TAF) — situação atual:
${tafLines}

Histórico recente de treinos:
${workoutLines}

${examLine}

TAF do CBMSC exige: corrida 2400m (menos de 12min40s para homens até 30 anos), flexões, barras, abdominais.

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

Inclua 3-5 sessões por semana com descanso adequado. Priorize os itens com maior gap do TAF.`;

    const result = await aiClient.completeJson<{
      phase: string;
      objective: string;
      weeks: TrainingWeek[];
    }>(prompt);

    const plan: FitnessTrainingPlan = {
      generatedAt: new Date().toISOString(),
      totalWeeks,
      phase: result.phase ?? phase,
      objective: result.objective ?? 'Preparação para o TAF do CBMSC',
      weeks: Array.isArray(result.weeks) ? result.weeks.slice(0, totalWeeks) : [],
    };

    this.savePlan(plan);
    return plan;
  },
};
