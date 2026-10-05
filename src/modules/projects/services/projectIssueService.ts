import { generateId } from '../../../shared/utils/generateId';
import {
  isIssueOpen,
  type IssueKind,
  type IssueSeverity,
  type IssueStatus,
  type ProjectIssue,
} from '../types/projectIssue';
import { readIssues, readTasks, recordEvent, touch, writeIssues, writeTasks } from './projectStorage';

type CreateIssueInput = {
  projectId: string;
  title: string;
  kind: IssueKind;
  frontId?: string;
  detail?: string;
  severity?: IssueSeverity;
};

/** Bug antes de melhoria antes de ideia; dentro disso, severidade alta primeiro. */
const KIND_WEIGHT: Record<IssueKind, number> = { bug: 0, improvement: 1, idea: 2 };
const SEVERITY_WEIGHT: Record<IssueSeverity, number> = { high: 0, medium: 1, low: 2 };

export const projectIssueService = {
  listByProject(projectId: string): ProjectIssue[] {
    return readIssues()
      .filter((i) => i.projectId === projectId)
      .sort((a, b) => {
        // Resolvidas e descartadas afundam: o inbox é sobre o que ainda incomoda.
        const openDiff = Number(!isIssueOpen(a)) - Number(!isIssueOpen(b));
        if (openDiff !== 0) return openDiff;
        const kindDiff = KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
        if (kindDiff !== 0) return kindDiff;
        return SEVERITY_WEIGHT[a.severity ?? 'medium'] - SEVERITY_WEIGHT[b.severity ?? 'medium'];
      });
  },

  countOpen(projectId: string): number {
    return readIssues().filter((i) => i.projectId === projectId && isIssueOpen(i)).length;
  },

  create(input: CreateIssueInput): ProjectIssue {
    const title = input.title.trim();
    if (!title) throw new Error('Descreva o ponto de melhoria.');

    const now = new Date().toISOString();
    const issue: ProjectIssue = {
      id: generateId('issue'),
      projectId: input.projectId,
      frontId: input.frontId,
      kind: input.kind,
      title,
      detail: input.detail?.trim() || undefined,
      severity: input.severity,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    writeIssues([...readIssues(), issue]);
    touch(input.projectId, input.frontId);
    recordEvent({
      projectId: input.projectId,
      frontId: input.frontId,
      entityType: 'issue',
      entityId: issue.id,
      kind: 'created',
      at: now,
    });
    return issue;
  },

  /** Renomeia. Título vazio é ignorado — a UI já bloqueia, isto é a segunda trava. */
  setTitle(id: string, title: string): ProjectIssue | null {
    const next = title.trim();
    if (!next) return null;
    const issues = readIssues();
    const issue = issues.find((i) => i.id === id);
    if (!issue || issue.title === next) return issue ?? null;
    issue.title = next;
    issue.updatedAt = new Date().toISOString();
    writeIssues(issues);
    touch(issue.projectId, issue.frontId);
    return issue;
  },

  setStatus(id: string, status: IssueStatus): ProjectIssue | null {
    const issues = readIssues();
    const issue = issues.find((i) => i.id === id);
    if (!issue) return null;

    const previous = issue.status;
    issue.status = status;
    issue.updatedAt = new Date().toISOString();
    writeIssues(issues);
    touch(issue.projectId, issue.frontId);
    if (previous !== status) {
      recordEvent({
        projectId: issue.projectId,
        frontId: issue.frontId,
        entityType: 'issue',
        entityId: issue.id,
        kind: 'status_changed',
        from: previous,
        to: status,
        at: issue.updatedAt,
      });
    }
    return issue;
  },

  /**
   * Promove a issue a tarefa de verdade — é aqui que ela passa a contar no
   * progresso do projeto. Antes disso o inbox pode encher à vontade sem
   * distorcer a medição, que é a razão de as duas coisas viverem separadas.
   */
  promoteToTask(id: string): { issue: ProjectIssue; taskId: string } | null {
    const issues = readIssues();
    const issue = issues.find((i) => i.id === id);
    if (!issue || issue.promotedTaskId) return null;

    const now = new Date().toISOString();
    const tasks = readTasks();
    const taskId = generateId('ptask');
    tasks.push({
      id: taskId,
      projectId: issue.projectId,
      frontId: issue.frontId,
      title: issue.title,
      status: 'todo',
      priority: issue.severity === 'high' ? 'high' : issue.severity === 'low' ? 'low' : 'medium',
      order: tasks.filter((t) => t.projectId === issue.projectId).length,
      createdAt: now,
      updatedAt: now,
    });
    writeTasks(tasks);

    const previous = issue.status;
    issue.promotedTaskId = taskId;
    issue.status = 'planned';
    issue.updatedAt = now;
    writeIssues(issues);
    touch(issue.projectId, issue.frontId);

    // Dois eventos porque são dois fatos: a tarefa passou a existir (e a partir
    // daqui conta no ritmo) e a issue saiu do inbox. É a promoção que a taxa de
    // aproveitamento do inbox mede.
    recordEvent({
      projectId: issue.projectId,
      frontId: issue.frontId,
      entityType: 'task',
      entityId: taskId,
      kind: 'created',
      at: now,
    });
    recordEvent({
      projectId: issue.projectId,
      frontId: issue.frontId,
      entityType: 'issue',
      entityId: issue.id,
      kind: 'status_changed',
      from: previous,
      to: 'planned',
      at: now,
    });
    return { issue, taskId };
  },

  remove(id: string): boolean {
    const issue = readIssues().find((i) => i.id === id);
    if (!issue) return false;
    writeIssues(readIssues().filter((i) => i.id !== id));
    touch(issue.projectId, issue.frontId);
    recordEvent({
      projectId: issue.projectId,
      frontId: issue.frontId,
      entityType: 'issue',
      entityId: issue.id,
      kind: 'removed',
    });
    return true;
  },
};
