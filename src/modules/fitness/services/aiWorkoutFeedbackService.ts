import { aiClient } from '../../../core/ai/aiClient';
import { PLAIN_TEXT_RULES } from '../../../core/ai/formatInstructions';
import { type Workout } from '../types/workout';
import { type TafTestResult } from './tafService';

export type WorkoutFeedback = {
  message: string;
  trend: 'improving' | 'steady' | 'declining' | 'first';
};

function formatWorkoutSummary(w: Workout): string {
  if (w.type === 'running') {
    const km = w.distanceMeters ? (w.distanceMeters / 1000).toFixed(2) : '?';
    const min = w.durationSeconds ? Math.floor(w.durationSeconds / 60) : null;
    const sec = w.durationSeconds ? w.durationSeconds % 60 : null;
    const time = min !== null ? `${min}min ${sec}s` : 'sem tempo';
    return `Corrida de ${km}km em ${time}`;
  }
  if (['sit_up', 'push_up', 'pull_up'].includes(w.type)) {
    const label = w.type === 'sit_up' ? 'Abdominal' : w.type === 'push_up' ? 'Flexão' : 'Barra';
    return `${label}: ${w.reps ?? '?'} repetições`;
  }
  return `Treino de ${w.type}`;
}

function detectTrend(current: Workout, previous: Workout | null): WorkoutFeedback['trend'] {
  if (!previous) return 'first';
  if (current.type === 'running') {
    const curr = current.distanceMeters ?? 0;
    const prev = previous.distanceMeters ?? 0;
    if (curr > prev) return 'improving';
    if (curr < prev) return 'declining';
    return 'steady';
  }
  const curr = current.reps ?? 0;
  const prev = previous.reps ?? 0;
  if (curr > prev) return 'improving';
  if (curr < prev) return 'declining';
  return 'steady';
}

export const aiWorkoutFeedbackService = {
  async getFeedback(
    current: Workout,
    previous: Workout | null,
    tafResult: TafTestResult | null,
  ): Promise<WorkoutFeedback> {
    const trend = detectTrend(current, previous);
    const currentSummary = formatWorkoutSummary(current);
    const previousSummary = previous ? formatWorkoutSummary(previous) : null;

    const tafContext = tafResult
      ? `Meta mínima TAF para ${tafResult.requirement.testName}: ${tafResult.requirement.minimumValue} ${tafResult.requirement.unit}. Melhor resultado atual: ${tafResult.bestValue ?? 'nenhum'} ${tafResult.requirement.unit}. Status: ${tafResult.status ?? 'sem dados'}.`
      : 'Sem dados TAF disponíveis para este exercício.';

    const prompt = `Você é um coach esportivo do concurso Bombeiro Militar SC (CBMSC). Acabei de registrar um treino e quero um feedback breve e motivador.

Treino atual: ${currentSummary}
${previousSummary ? `Treino anterior (mesmo tipo): ${previousSummary}` : 'Primeiro treino deste tipo registrado.'}
${tafContext}

Gere um feedback curto (2-3 frases) em português que:
1. Comente a sessão em relação ao anterior (se houver)
2. Mencione a distância para a meta TAF (se houver gap)
3. Encerre com motivação específica ao concurso

${PLAIN_TEXT_RULES}

Responda APENAS com JSON: { "message": "texto do feedback aqui" }`;

    try {
      const result = await aiClient.completeJson<{ message: string }>(prompt);
      return { message: result.message, trend };
    } catch {
      const fallbackMessages: Record<WorkoutFeedback['trend'], string> = {
        first: 'Primeiro passo dado! Continue registrando para acompanhar sua evolução.',
        improving: 'Evolução detectada! Continue assim rumo ao CBMSC.',
        steady: 'Consistência é fundamental. Mantenha o ritmo!',
        declining: 'Dia difícil? Recuperação faz parte do processo. Volte mais forte.',
      };
      return { message: fallbackMessages[trend], trend };
    }
  },
};
