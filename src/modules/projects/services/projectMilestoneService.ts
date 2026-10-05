import { generateId } from '../../../shared/utils/generateId';
import { isMilestoneOverdue, type ProjectMilestone } from '../types/projectMilestone';
import { readMilestones, recordEvent, touch, writeMilestones } from './projectStorage';

type CreateMilestoneInput = {
  projectId: string;
  title: string;
  frontId?: string;
  targetDate?: string;
};

/** Data de hoje em YYYY-MM-DD, para comparar com `targetDate` sem fuso no meio. */
export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const projectMilestoneService = {
  /**
   * Ordena por data planejada, e marco sem data vai para o fim.
   *
   * Sem data não quer dizer "urgente" nem "distante" — quer dizer que ninguém
   * se comprometeu. Deixar no fim evita que um marco sem prazo apareça na
   * frente de outro que tem data marcada para amanhã.
   */
  listByProject(projectId: string): ProjectMilestone[] {
    return readMilestones()
      .filter((m) => m.projectId === projectId)
      .sort((a, b) => {
        if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
        if (a.targetDate) return -1;
        if (b.targetDate) return 1;
        return a.order - b.order;
      });
  },

  /** Atingidos e total — é isto que substitui a porcentagem de tarefas. */
  getProgress(projectId: string): { reached: number; total: number } {
    const list = this.listByProject(projectId);
    return { reached: list.filter((m) => m.reachedAt).length, total: list.length };
  },

  listOverdue(projectId?: string): ProjectMilestone[] {
    const today = todayDate();
    return readMilestones().filter(
      (m) => (projectId === undefined || m.projectId === projectId) && isMilestoneOverdue(m, today),
    );
  },

  create(input: CreateMilestoneInput): ProjectMilestone {
    const title = input.title.trim();
    if (!title) throw new Error('Informe o nome do marco.');

    const now = new Date().toISOString();
    const siblings = readMilestones().filter((m) => m.projectId === input.projectId);
    const milestone: ProjectMilestone = {
      id: generateId('milestone'),
      projectId: input.projectId,
      frontId: input.frontId,
      title,
      targetDate: input.targetDate || undefined,
      order: siblings.length,
      createdAt: now,
      updatedAt: now,
    };
    writeMilestones([...readMilestones(), milestone]);
    touch(input.projectId, input.frontId);
    recordEvent({
      projectId: input.projectId,
      frontId: input.frontId,
      entityType: 'milestone',
      entityId: milestone.id,
      kind: 'created',
      at: now,
    });
    return milestone;
  },

  /** Alterna atingido/pendente. Clicar de novo desfaz — marco marcado por engano é comum. */
  toggleReached(id: string): ProjectMilestone | null {
    const milestones = readMilestones();
    const milestone = milestones.find((m) => m.id === id);
    if (!milestone) return null;

    const now = new Date().toISOString();
    const wasReached = Boolean(milestone.reachedAt);
    milestone.reachedAt = wasReached ? undefined : now;
    milestone.updatedAt = now;
    writeMilestones(milestones);
    touch(milestone.projectId, milestone.frontId);
    recordEvent({
      projectId: milestone.projectId,
      frontId: milestone.frontId,
      entityType: 'milestone',
      entityId: milestone.id,
      kind: 'status_changed',
      from: wasReached ? 'reached' : 'pending',
      to: wasReached ? 'pending' : 'reached',
      at: now,
    });
    return milestone;
  },

  update(id: string, updates: { title?: string; targetDate?: string }): ProjectMilestone | null {
    const milestones = readMilestones();
    const milestone = milestones.find((m) => m.id === id);
    if (!milestone) return null;

    const previousDate = milestone.targetDate;
    if (updates.title !== undefined) milestone.title = updates.title.trim() || milestone.title;
    if (updates.targetDate !== undefined) milestone.targetDate = updates.targetDate || undefined;
    milestone.updatedAt = new Date().toISOString();
    writeMilestones(milestones);
    touch(milestone.projectId, milestone.frontId);

    // Empurrar a data do marco é o sinal mais honesto de plano furando —
    // mais do que o marco vencer, que só constata o fato depois.
    if (previousDate && milestone.targetDate && milestone.targetDate > previousDate) {
      recordEvent({
        projectId: milestone.projectId,
        frontId: milestone.frontId,
        entityType: 'milestone',
        entityId: milestone.id,
        kind: 'due_moved',
        from: previousDate,
        to: milestone.targetDate,
        at: milestone.updatedAt,
      });
    }
    return milestone;
  },

  remove(id: string): boolean {
    const milestone = readMilestones().find((m) => m.id === id);
    if (!milestone) return false;
    writeMilestones(readMilestones().filter((m) => m.id !== id));
    touch(milestone.projectId, milestone.frontId);
    recordEvent({
      projectId: milestone.projectId,
      frontId: milestone.frontId,
      entityType: 'milestone',
      entityId: milestone.id,
      kind: 'removed',
    });
    return true;
  },
};
