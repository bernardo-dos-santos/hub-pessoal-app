import { readEvents, readIssues, readTasks } from './projectStorage';
import { isTaskClosed, type ProjectTask } from '../types/projectTask';

export type WeeklyPoint = { weekStart: string; count: number };

export type AgingBucket = { label: string; count: number };

export type IssueFlow = { total: number; promoted: number; discarded: number; open: number };

const DAY_MS = 86_400_000;

/** Segunda-feira da semana de uma data ISO, em YYYY-MM-DD. */
function weekStart(iso: string): string {
  const date = new Date(iso);
  const day = (date.getUTCDay() + 6) % 7; // 0 = segunda
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export const projectMetricsService = {
  /**
   * Quando o histórico deste projeto começa.
   *
   * A tela PRECISA disto. O log de eventos nasceu em determinado dia, e sem
   * essa data um gráfico desenharia zero fechamentos para todo mês anterior —
   * o que não é "nada aconteceu", é "não estávamos gravando". Um zero honesto
   * e um zero por ignorância parecem idênticos num gráfico de barras.
   */
  historyStartsAt(projectId: string): string | null {
    const events = readEvents().filter((e) => e.projectId === projectId);
    if (events.length === 0) return null;
    return events.reduce((oldest, e) => (e.at < oldest ? e.at : oldest), events[0].at);
  },

  /**
   * Tarefas fechadas por semana — o ritmo real, não a sensação.
   *
   * Conta evento, não estado atual: uma tarefa fechada e reaberta aparece na
   * semana em que foi fechada, que é a semana em que o trabalho aconteceu.
   */
  closedByWeek(projectId: string, weeks = 12): WeeklyPoint[] {
    const closed = readEvents().filter(
      (e) => e.projectId === projectId
        && e.entityType === 'task'
        && e.kind === 'status_changed'
        && e.to === 'done',
    );

    const counts = new Map<string, number>();
    for (const event of closed) {
      const key = weekStart(event.at);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Semanas sem fechamento precisam aparecer como zero, senão o gráfico
    // comprime o tempo e um mês parado vira um pulo invisível entre barras.
    const points: WeeklyPoint[] = [];
    const cursor = new Date(`${weekStart(new Date().toISOString())}T00:00:00Z`);
    for (let i = 0; i < weeks; i++) {
      const key = cursor.toISOString().slice(0, 10);
      points.unshift({ weekStart: key, count: counts.get(key) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    }
    return points;
  },

  /**
   * Distribuição das tarefas abertas por idade — mostra o que está apodrecendo
   * em silêncio. Uma tarefa de 90 dias não aparece em nenhum alerta de prazo
   * (ela nem tem prazo), mas é a que mais diz sobre o projeto.
   */
  openTaskAging(projectId: string): AgingBucket[] {
    const now = new Date().toISOString();
    const open = readTasks().filter((t) => t.projectId === projectId && !isTaskClosed(t));
    const buckets: AgingBucket[] = [
      { label: 'até 1 semana', count: 0 },
      { label: '1 a 4 semanas', count: 0 },
      { label: '1 a 3 meses', count: 0 },
      { label: 'mais de 3 meses', count: 0 },
    ];
    for (const task of open) {
      const age = daysBetween(task.createdAt, now);
      if (age <= 7) buckets[0].count++;
      else if (age <= 28) buckets[1].count++;
      else if (age <= 90) buckets[2].count++;
      else buckets[3].count++;
    }
    return buckets;
  },

  /**
   * Mediana de dias entre criar e fechar, em dias.
   *
   * Mediana e não média: uma única tarefa esquecida por um ano puxaria a média
   * para um número que não descreve nenhuma semana real de trabalho.
   *
   * Só considera tarefas cujo fechamento está no log — as fechadas antes de o
   * histórico existir ficam de fora, e é por isso que a tela mostra desde
   * quando o histórico vale.
   */
  medianDaysToClose(projectId: string, frontId?: string): number | null {
    const tasksById = new Map(readTasks().map((t) => [t.id, t]));
    const durations: number[] = [];

    for (const event of readEvents()) {
      if (event.projectId !== projectId) continue;
      if (event.entityType !== 'task' || event.kind !== 'status_changed' || event.to !== 'done') continue;
      const task = tasksById.get(event.entityId);
      if (!task) continue; // apagada depois de fechada — não dá para medir
      if (frontId !== undefined && task.frontId !== frontId) continue;
      durations.push(daysBetween(task.createdAt, event.at));
    }

    return median(durations);
  },

  /**
   * O que acontece com o que entra no inbox de melhorias.
   *
   * Diz se o inbox funciona ou se virou cemitério: anotar é barato, e um
   * inbox onde nada nunca vira tarefa é um lugar de despejo, não uma fila.
   */
  issueFlow(projectId: string): IssueFlow {
    const issues = readIssues().filter((i) => i.projectId === projectId);
    return {
      total: issues.length,
      promoted: issues.filter((i) => i.promotedTaskId).length,
      discarded: issues.filter((i) => i.status === 'wontfix').length,
      open: issues.filter((i) => i.status === 'open').length,
    };
  },

  /** Tarefas abertas mais antigas primeiro — a lista que acompanha o gráfico de idade. */
  oldestOpenTasks(projectId: string, limit = 5): ProjectTask[] {
    return readTasks()
      .filter((t) => t.projectId === projectId && !isTaskClosed(t))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  },
};
