import { type BaseEntity } from '../../../shared/types/base-entity';

export type ProjectTaskStatus = 'todo' | 'doing' | 'done' | 'canceled';
export type ProjectTaskPriority = 'low' | 'medium' | 'high';

export const TASK_STATUS_LABEL: Record<ProjectTaskStatus, string> = {
  todo: 'A fazer',
  doing: 'Em andamento',
  done: 'Concluída',
  canceled: 'Cancelada',
};

export const TASK_PRIORITY_LABEL: Record<ProjectTaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export type ProjectTask = BaseEntity & {
  projectId: string;
  /** Opcional: tarefa pode viver solta no projeto, sem frente nenhuma. */
  frontId?: string;
  /** É isto que cria subtarefa — não existe entidade separada pra isso. */
  parentTaskId?: string;
  title: string;
  status: ProjectTaskStatus;
  priority?: ProjectTaskPriority;
  dueDate?: string;
  /**
   * Quantas vezes o prazo foi empurrado para frente.
   *
   * É a "migração" do Bullet Journal em forma digital: lá, reescrever à mão
   * uma tarefa adiada cria atrito, e o atrito mata tarefa que nunca importou.
   * Aqui adiar é grátis, então o contador é o que devolve o sinal — tarefa
   * empurrada três vezes provavelmente não deveria estar na lista.
   */
  dueMoveCount?: number;
  order: number;
};

/** A partir de quantos adiamentos a tarefa vira sugestão de cancelamento. */
export const DUE_MOVE_ALERT_THRESHOLD = 3;

/** Status que contam como "fechada" — usado em progresso e em filtros. */
export function isTaskClosed(task: ProjectTask): boolean {
  return task.status === 'done' || task.status === 'canceled';
}

/** Vencida: tem prazo, o prazo passou e a tarefa ainda está aberta. */
export function isTaskOverdue(task: ProjectTask, today: string): boolean {
  if (!task.dueDate || isTaskClosed(task)) return false;
  return task.dueDate < today;
}

/** Vence nos próximos `days` dias (inclusive hoje) e ainda está aberta. */
export function isTaskDueSoon(task: ProjectTask, today: string, days = 3): boolean {
  if (!task.dueDate || isTaskClosed(task) || task.dueDate < today) return false;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  return task.dueDate <= limit.toISOString().slice(0, 10);
}
