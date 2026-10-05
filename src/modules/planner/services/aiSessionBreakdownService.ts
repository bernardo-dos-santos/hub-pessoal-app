import { aiClient } from '../../../core/ai/aiClient';
import { type StudyBreakdownItem, type WeeklySession } from '../types/routine';

export async function generateSessionBreakdown(session: WeeklySession): Promise<StudyBreakdownItem[]> {
  const prompt = `Você é um tutor especialista. Detalhe a ordem de estudo para esta sessão específica.

Sessão: "${session.topic}"
Duração total: ${session.durationMinutes} minutos
Motivo/contexto: ${session.reason}

Divida em sub-tópicos em ordem lógica de estudo (do mais básico ao mais complexo). Cada sub-tópico deve ser concreto e acionável — o que exatamente estudar, como (exercícios, leitura, revisão de fórmulas), e por quanto tempo.

A soma de durationMinutes dos sub-tópicos deve ser próxima de ${session.durationMinutes} minutos.

Retorne APENAS um array JSON sem markdown:
[{"subtopic":"...","durationMinutes":20,"instruction":"O que exatamente fazer nesse bloco"}]`;

  const raw = await aiClient.completeJson(prompt);
  if (!Array.isArray(raw)) throw new Error('Resposta inválida da IA.');
  return (raw as StudyBreakdownItem[]).filter(
    (item) =>
      item &&
      typeof item.subtopic === 'string' &&
      typeof item.durationMinutes === 'number' &&
      typeof item.instruction === 'string',
  );
}
