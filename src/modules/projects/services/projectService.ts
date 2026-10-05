import { generateId } from '../../../shared/utils/generateId';
import {
  DEFAULT_NUDGE_AFTER_DAYS, type Project, type ProjectKind, type ProjectStatus,
} from '../types/project';
import { isTaskClosed } from '../types/projectTask';
import {
  readDecisions, readEvents, readExpansions, readFronts, readIssues, readMilestones, readProjects,
  readTasks, recordEvent, touch, writeDecisions, writeEvents, writeExpansions, writeFronts,
  writeIssues, writeMilestones, writeProjects, writeTasks,
} from './projectStorage';

export type ProjectRemovalSummary = {
  fronts: number;
  tasks: number;
  issues: number;
  decisions: number;
  expansions: number;
  milestones: number;
};

export type ProjectProgress = {
  total: number;
  done: number;
  percent: number;
};

function todayIso(): string {
  return new Date().toISOString();
}

/** Dias inteiros desde uma data ISO. */
export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export const projectService = {
  list(): Project[] {
    return readProjects();
  },

  /** Ativos primeiro, depois pausados; concluídos e arquivados no fim. */
  listSorted(): Project[] {
    const weight: Record<ProjectStatus, number> = { active: 0, paused: 1, done: 2, archived: 3 };
    return [...readProjects()].sort((a, b) => {
      const byStatus = weight[a.status] - weight[b.status];
      if (byStatus !== 0) return byStatus;
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
  },

  getById(id: string): Project | null {
    return readProjects().find((p) => p.id === id) ?? null;
  },

  create(input: {
    name: string; description?: string; targetDate?: string; kind?: ProjectKind;
    repoId?: number; repoName?: string;
  }): Project {
    const name = input.name.trim();
    if (!name) throw new Error('Informe o nome do projeto.');

    const now = todayIso();
    const kind: ProjectKind = input.kind ?? 'other';
    // Repositório só é gravado em projeto de código: escolher uma natureza e
    // arrastar junto um repo de um formulário anterior deixaria dado morto que
    // reapareceria se a natureza voltasse a ser 'code'.
    const linksRepo = kind === 'code' && input.repoId != null;
    const project: Project = {
      id: generateId('project'),
      name,
      description: input.description?.trim() || undefined,
      status: 'active',
      kind,
      startedAt: now,
      targetDate: input.targetDate || undefined,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      repoId: linksRepo ? input.repoId : undefined,
      repoName: linksRepo ? input.repoName : undefined,
    };
    writeProjects([project, ...readProjects()]);
    recordEvent({
      projectId: project.id,
      entityType: 'project',
      entityId: project.id,
      kind: 'created',
      at: now,
    });
    return project;
  },

  update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const projects = readProjects();
    const project = projects.find((p) => p.id === id);
    if (!project) return null;

    const previousStatus = project.status;
    Object.assign(project, updates, {
      id: project.id,
      createdAt: project.createdAt,
      updatedAt: todayIso(),
      lastActivityAt: todayIso(),
    });
    if (updates.status === 'done' && !project.completedAt) project.completedAt = todayIso();
    writeProjects(projects);
    if (previousStatus !== project.status) {
      recordEvent({
        projectId: project.id,
        entityType: 'project',
        entityId: project.id,
        kind: 'status_changed',
        from: previousStatus,
        to: project.status,
        at: project.updatedAt,
      });
    }
    return project;
  },

  /** Quanto sumiria junto — alimenta a confirmação antes de excluir. */
  previewRemoval(id: string): ProjectRemovalSummary {
    return {
      fronts: readFronts().filter((f) => f.projectId === id).length,
      tasks: readTasks().filter((t) => t.projectId === id).length,
      issues: readIssues().filter((i) => i.projectId === id).length,
      decisions: readDecisions().filter((d) => d.projectId === id).length,
      expansions: readExpansions().filter((e) => e.projectId === id).length,
      milestones: readMilestones().filter((m) => m.projectId === id).length,
    };
  },

  /**
   * Exclui o projeto E tudo que pertence a ele. O cascade nasce junto com o
   * módulo de propósito: nas duas vezes que ficou pra depois neste projeto
   * (disciplina da faculdade, plano semanal) o resultado foi dado órfão que
   * seguiu contando em telas e médias.
   */
  remove(id: string): ProjectRemovalSummary {
    const removed = this.previewRemoval(id);
    writeExpansions(readExpansions().filter((e) => e.projectId !== id));
    writeMilestones(readMilestones().filter((m) => m.projectId !== id));
    writeDecisions(readDecisions().filter((d) => d.projectId !== id));
    writeIssues(readIssues().filter((i) => i.projectId !== id));
    writeTasks(readTasks().filter((t) => t.projectId !== id));
    writeFronts(readFronts().filter((f) => f.projectId !== id));
    // O histórico sai junto: evento de projeto que não existe mais não tem como
    // ser lido por tela nenhuma e só ocuparia espaço no snapshot do store.
    writeEvents(readEvents().filter((e) => e.projectId !== id));
    writeProjects(readProjects().filter((p) => p.id !== id));
    return removed;
  },

  /** Progresso pelas tarefas — canceladas não contam nem como feitas nem como pendentes. */
  getProgress(projectId: string): ProjectProgress {
    const tasks = readTasks().filter((t) => t.projectId === projectId && t.status !== 'canceled');
    const done = tasks.filter((t) => t.status === 'done').length;
    return {
      total: tasks.length,
      done,
      percent: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0,
    };
  },

  openTaskCount(projectId: string): number {
    return readTasks().filter((t) => t.projectId === projectId && !isTaskClosed(t)).length;
  },

  /** Passou do limite de dias parado? Projeto não-ativo nunca cobra. */
  isStalled(project: Project): boolean {
    if (project.status !== 'active') return false;
    return daysSince(project.lastActivityAt) >= (project.nudgeAfterDays ?? DEFAULT_NUDGE_AFTER_DAYS);
  },

  listStalled(): Project[] {
    return readProjects().filter((p) => this.isStalled(p));
  },

  touchProject(projectId: string): void {
    touch(projectId);
  },
};
