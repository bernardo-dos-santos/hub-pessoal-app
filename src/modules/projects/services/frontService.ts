import { generateId } from '../../../shared/utils/generateId';
import { type Front, type FrontStatus } from '../types/front';
import { isTaskClosed } from '../types/projectTask';
import { readFronts, readTasks, recordEvent, touch, writeFronts, writeTasks } from './projectStorage';

export type FrontRemovalSummary = {
  /** Tarefas que ficam SEM frente (não são apagadas). */
  orphanedTasks: number;
};

export const frontService = {
  listByProject(projectId: string): Front[] {
    const weight: Record<FrontStatus, number> = { active: 0, paused: 1, done: 2 };
    return readFronts()
      .filter((f) => f.projectId === projectId)
      .sort((a, b) => weight[a.status] - weight[b.status] || a.name.localeCompare(b.name));
  },

  getById(id: string): Front | null {
    return readFronts().find((f) => f.id === id) ?? null;
  },

  create(projectId: string, name: string): Front {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Informe o nome da frente.');

    const now = new Date().toISOString();
    const front: Front = {
      id: generateId('front'),
      projectId,
      name: trimmed,
      status: 'active',
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };
    writeFronts([...readFronts(), front]);
    touch(projectId);
    recordEvent({
      projectId,
      frontId: front.id,
      entityType: 'front',
      entityId: front.id,
      kind: 'created',
      at: now,
    });
    return front;
  },

  update(id: string, updates: Partial<Omit<Front, 'id' | 'projectId' | 'createdAt'>>): Front | null {
    const fronts = readFronts();
    const front = fronts.find((f) => f.id === id);
    if (!front) return null;

    const previousStatus = front.status;
    Object.assign(front, updates, {
      id: front.id,
      projectId: front.projectId,
      createdAt: front.createdAt,
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    });
    writeFronts(fronts);
    touch(front.projectId);
    // Só mudança de status vira evento — renomear frente ou editar escopo git
    // não é fato histórico, é correção de cadastro.
    if (previousStatus !== front.status) {
      recordEvent({
        projectId: front.projectId,
        frontId: front.id,
        entityType: 'front',
        entityId: front.id,
        kind: 'status_changed',
        from: previousStatus,
        to: front.status,
        at: front.updatedAt,
      });
    }
    return front;
  },

  previewRemoval(id: string): FrontRemovalSummary {
    return { orphanedTasks: readTasks().filter((t) => t.frontId === id).length };
  },

  /**
   * Remove a frente e SOLTA as tarefas dela no projeto, em vez de apagá-las.
   *
   * Diferente do cascade do projeto de propósito: fechar uma frente é decisão de
   * organização, não de descarte — apagar trabalho real junto seria destrutivo
   * demais pra uma ação que parece leve.
   */
  remove(id: string): FrontRemovalSummary {
    const front = this.getById(id);
    if (!front) return { orphanedTasks: 0 };

    const removed = this.previewRemoval(id);
    const tasks = readTasks();
    for (const task of tasks) {
      if (task.frontId === id) task.frontId = undefined;
    }
    writeTasks(tasks);
    writeFronts(readFronts().filter((f) => f.id !== id));
    touch(front.projectId);
    recordEvent({
      projectId: front.projectId,
      frontId: front.id,
      entityType: 'front',
      entityId: front.id,
      kind: 'removed',
    });
    return removed;
  },

  openTaskCount(frontId: string): number {
    return readTasks().filter((t) => t.frontId === frontId && !isTaskClosed(t)).length;
  },
};
