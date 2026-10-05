import { generateId } from '../../../shared/utils/generateId';
import { type ProjectTask, type ProjectTaskPriority, type ProjectTaskStatus } from '../types/projectTask';
import { clearNextActionFor, readTasks, recordEvent, touch, writeTasks } from './projectStorage';

type CreateTaskInput = {
  projectId: string;
  title: string;
  frontId?: string;
  parentTaskId?: string;
  priority?: ProjectTaskPriority;
  dueDate?: string;
};

export const projectTaskService = {
  listByProject(projectId: string): ProjectTask[] {
    return readTasks()
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  },

  /** Só as de primeiro nível — subtarefas saem aninhadas via listSubtasks. */
  listRoot(projectId: string, frontId?: string): ProjectTask[] {
    return this.listByProject(projectId).filter(
      (t) => !t.parentTaskId && (frontId === undefined || t.frontId === frontId),
    );
  },

  /** Tarefas sem frente nenhuma — projeto simples vive só disto. */
  listLoose(projectId: string): ProjectTask[] {
    return this.listByProject(projectId).filter((t) => !t.parentTaskId && !t.frontId);
  },

  listSubtasks(parentTaskId: string): ProjectTask[] {
    return readTasks()
      .filter((t) => t.parentTaskId === parentTaskId)
      .sort((a, b) => a.order - b.order);
  },

  create(input: CreateTaskInput): ProjectTask {
    const title = input.title.trim();
    if (!title) throw new Error('Informe o título da tarefa.');

    const now = new Date().toISOString();
    const siblings = readTasks().filter((t) => t.projectId === input.projectId);
    const task: ProjectTask = {
      id: generateId('ptask'),
      projectId: input.projectId,
      frontId: input.frontId,
      parentTaskId: input.parentTaskId,
      title,
      status: 'todo',
      priority: input.priority,
      dueDate: input.dueDate,
      order: siblings.length,
      createdAt: now,
      updatedAt: now,
    };
    writeTasks([...readTasks(), task]);
    touch(input.projectId, input.frontId);
    recordEvent({
      projectId: input.projectId,
      frontId: input.frontId,
      entityType: 'task',
      entityId: task.id,
      kind: 'created',
      at: now,
    });
    return task;
  },

  setStatus(id: string, status: ProjectTaskStatus): ProjectTask | null {
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    const previous = task.status;
    task.status = status;
    task.updatedAt = new Date().toISOString();

    // Fechar a mãe fecha as filhas: subtarefa aberta sob tarefa concluída é
    // estado impossível, e faria a contagem de pendências mentir.
    const cascaded: { id: string; from: ProjectTaskStatus; frontId?: string }[] = [];
    if (status === 'done' || status === 'canceled') {
      for (const child of tasks) {
        if (child.parentTaskId === id && child.status !== 'canceled') {
          cascaded.push({ id: child.id, from: child.status, frontId: child.frontId });
          child.status = status;
          child.updatedAt = task.updatedAt;
        }
      }
    }

    writeTasks(tasks);
    // Tarefa fechada deixa de ser "próximo passo" — inclusive as filhas que
    // fecharam junto, que também podiam estar marcadas.
    if (status === 'done' || status === 'canceled') {
      clearNextActionFor([task.id, ...cascaded.map((c) => c.id)]);
    }
    touch(task.projectId, task.frontId);

    // A filha fechada em cascata também vira evento: sem isso, o ritmo semanal
    // contaria uma tarefa onde o trabalho fechado foi de várias.
    if (previous !== status) {
      recordEvent({
        projectId: task.projectId,
        frontId: task.frontId,
        entityType: 'task',
        entityId: task.id,
        kind: 'status_changed',
        from: previous,
        to: status,
        at: task.updatedAt,
      });
    }
    for (const child of cascaded) {
      recordEvent({
        projectId: task.projectId,
        frontId: child.frontId,
        entityType: 'task',
        entityId: child.id,
        kind: 'status_changed',
        from: child.from,
        to: status,
        at: task.updatedAt,
      });
    }
    return task;
  },

  /**
   * Define ou limpa o prazo. Empurrar para frente incrementa `dueMoveCount` —
   * é o contador que devolve o atrito que o papel tinha e o digital perdeu.
   */
  setDueDate(id: string, dueDate?: string): ProjectTask | null {
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    const previous = task.dueDate;
    const next = dueDate || undefined;
    if (previous === next) return task;

    const pushedForward = Boolean(previous && next && next > previous);
    task.dueDate = next;
    if (pushedForward) task.dueMoveCount = (task.dueMoveCount ?? 0) + 1;
    task.updatedAt = new Date().toISOString();
    writeTasks(tasks);
    touch(task.projectId, task.frontId);

    if (pushedForward) {
      recordEvent({
        projectId: task.projectId,
        frontId: task.frontId,
        entityType: 'task',
        entityId: task.id,
        kind: 'due_moved',
        from: previous,
        to: next,
        at: task.updatedAt,
      });
    }
    return task;
  },

  /** Renomeia. Título vazio é ignorado — a UI já bloqueia, isto é a segunda trava. */
  setTitle(id: string, title: string): ProjectTask | null {
    const next = title.trim();
    if (!next) return null;
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task || task.title === next) return task ?? null;
    task.title = next;
    task.updatedAt = new Date().toISOString();
    writeTasks(tasks);
    touch(task.projectId, task.frontId);
    return task;
  },

  setPriority(id: string, priority?: ProjectTaskPriority): ProjectTask | null {
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;
    task.priority = priority;
    task.updatedAt = new Date().toISOString();
    writeTasks(tasks);
    touch(task.projectId, task.frontId);
    return task;
  },

  /** A tarefa apontada como próximo passo daquela frente, se ainda houver uma. */
  getNextAction(nextActionTaskId?: string): ProjectTask | null {
    if (!nextActionTaskId) return null;
    return readTasks().find((t) => t.id === nextActionTaskId) ?? null;
  },

  /** Move a tarefa pra outra frente, ou pra fora de todas (frontId undefined). */
  moveToFront(id: string, frontId?: string): ProjectTask | null {
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    task.frontId = frontId;
    task.updatedAt = new Date().toISOString();
    // Subtarefa acompanha a mãe — separar as duas em frentes diferentes não faz sentido.
    for (const child of tasks) {
      if (child.parentTaskId === id) child.frontId = frontId;
    }
    writeTasks(tasks);
    touch(task.projectId, frontId);
    return task;
  },

  /** Remove a tarefa e suas subtarefas. Retorna quantas saíram no total. */
  remove(id: string): number {
    const tasks = readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return 0;

    const doomed = new Set([id]);
    for (const t of tasks) {
      if (t.parentTaskId === id) doomed.add(t.id);
    }
    writeTasks(tasks.filter((t) => !doomed.has(t.id)));
    clearNextActionFor([...doomed]);
    touch(task.projectId, task.frontId);
    for (const doomedId of doomed) {
      recordEvent({
        projectId: task.projectId,
        frontId: task.frontId,
        entityType: 'task',
        entityId: doomedId,
        kind: 'removed',
      });
    }
    return doomed.size;
  },
};
