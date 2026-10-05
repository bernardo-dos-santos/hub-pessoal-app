import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type Project } from '../types/project';
import { type Front } from '../types/front';
import { type ProjectTask } from '../types/projectTask';
import { type ProjectIssue } from '../types/projectIssue';
import { type ProjectDecision } from '../types/projectDecision';
import { type ProjectExpansion } from '../types/projectExpansion';
import { type ProjectMilestone } from '../types/projectMilestone';
import {
  PROJECT_EVENT_LIMIT,
  type ProjectEvent,
  type ProjectEventEntity,
  type ProjectEventKind,
} from '../types/projectEvent';

export const projectKeys = {
  projects: 'projects.list',
  fronts: 'projects.fronts',
  tasks: 'projects.tasks',
  issues: 'projects.issues',
  decisions: 'projects.decisions',
  expansions: 'projects.expansions',
  milestones: 'projects.milestones',
  events: 'projects.events',
} as const;

/**
 * Leitura/escrita cruas das três coleções.
 *
 * Ficam juntas num arquivo só porque o cascade de exclusão precisa mexer em
 * todas de uma vez, e um serviço importando o outro criaria ciclo — foi
 * exatamente o que impediu `weeklyPlanService` de limpar as completions
 * sozinho, e acabou obrigando a página a orquestrar.
 */
export function readProjects(): Project[] {
  return storageAdapter.getItem<Project[]>(projectKeys.projects) ?? [];
}

export function writeProjects(projects: Project[]): void {
  storageAdapter.setItem(projectKeys.projects, projects);
}

export function readFronts(): Front[] {
  return storageAdapter.getItem<Front[]>(projectKeys.fronts) ?? [];
}

export function writeFronts(fronts: Front[]): void {
  storageAdapter.setItem(projectKeys.fronts, fronts);
}

export function readTasks(): ProjectTask[] {
  return storageAdapter.getItem<ProjectTask[]>(projectKeys.tasks) ?? [];
}

export function writeTasks(tasks: ProjectTask[]): void {
  storageAdapter.setItem(projectKeys.tasks, tasks);
}

export function readIssues(): ProjectIssue[] {
  return storageAdapter.getItem<ProjectIssue[]>(projectKeys.issues) ?? [];
}

export function writeIssues(issues: ProjectIssue[]): void {
  storageAdapter.setItem(projectKeys.issues, issues);
}

export function readDecisions(): ProjectDecision[] {
  return storageAdapter.getItem<ProjectDecision[]>(projectKeys.decisions) ?? [];
}

export function writeDecisions(decisions: ProjectDecision[]): void {
  storageAdapter.setItem(projectKeys.decisions, decisions);
}

export function readExpansions(): ProjectExpansion[] {
  return storageAdapter.getItem<ProjectExpansion[]>(projectKeys.expansions) ?? [];
}

export function writeExpansions(expansions: ProjectExpansion[]): void {
  storageAdapter.setItem(projectKeys.expansions, expansions);
}

export function readMilestones(): ProjectMilestone[] {
  return storageAdapter.getItem<ProjectMilestone[]>(projectKeys.milestones) ?? [];
}

export function writeMilestones(milestones: ProjectMilestone[]): void {
  storageAdapter.setItem(projectKeys.milestones, milestones);
}

export function readEvents(): ProjectEvent[] {
  return storageAdapter.getItem<ProjectEvent[]>(projectKeys.events) ?? [];
}

export function writeEvents(events: ProjectEvent[]): void {
  storageAdapter.setItem(projectKeys.events, events);
}

/**
 * Marca atividade no projeto e, quando houver, na frente.
 *
 * Chamado por toda escrita. É o motor da cobrança: se um caminho de escrita
 * esquecer de chamar, o projeto passa a parecer ativo sem ninguém tocar nele —
 * e o erro é silencioso, nada quebra, só a informação fica mentindo.
 */
export function touch(projectId: string, frontId?: string): void {
  const now = new Date().toISOString();

  const projects = readProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project) {
    project.lastActivityAt = now;
    project.updatedAt = now;
    writeProjects(projects);
  }

  if (!frontId) return;
  const fronts = readFronts();
  const front = fronts.find((f) => f.id === frontId);
  if (front) {
    front.lastActivityAt = now;
    front.updatedAt = now;
    writeFronts(fronts);
  }
}

/**
 * Como `touch()`, mas pra uma data específica (não "agora") — e só avança
 * `lastActivityAt` se a data for mais nova que a atual. Usado pelo sync de
 * git: um commit antigo, ao ser processado num backfill, não pode fazer uma
 * frente parada parecer ativa hoje. Idempotente por construção.
 */
export function touchAt(projectId: string, iso: string, frontId?: string): void {
  const projects = readProjects();
  const project = projects.find((p) => p.id === projectId);
  if (project && iso > project.lastActivityAt) {
    project.lastActivityAt = iso;
    writeProjects(projects);
  }

  if (!frontId) return;
  const fronts = readFronts();
  const front = fronts.find((f) => f.id === frontId);
  if (front && iso > front.lastActivityAt) {
    front.lastActivityAt = iso;
    writeFronts(fronts);
  }
}

/**
 * Solta a marca de "próxima ação" de qualquer frente ou projeto que aponte
 * para uma das tarefas informadas.
 *
 * Chamado quando a tarefa fecha ou é apagada. Sem isso, a frente continuaria
 * exibindo como próximo passo algo já concluído — e o alerta de "frente sem
 * próxima ação" nunca dispararia, porque o campo estaria preenchido apontando
 * para o vazio. É o mesmo tipo de falha silenciosa que `touch()` documenta:
 * nada quebra, só a informação passa a mentir.
 */
export function clearNextActionFor(taskIds: string[]): void {
  if (taskIds.length === 0) return;
  const doomed = new Set(taskIds);

  const fronts = readFronts();
  let frontsChanged = false;
  for (const front of fronts) {
    if (front.nextActionTaskId && doomed.has(front.nextActionTaskId)) {
      front.nextActionTaskId = undefined;
      frontsChanged = true;
    }
  }
  if (frontsChanged) writeFronts(fronts);

  const projects = readProjects();
  let projectsChanged = false;
  for (const project of projects) {
    if (project.nextActionTaskId && doomed.has(project.nextActionTaskId)) {
      project.nextActionTaskId = undefined;
      projectsChanged = true;
    }
  }
  if (projectsChanged) writeProjects(projects);
}

/**
 * Grava um evento no histórico do projeto.
 *
 * Mora junto de `touch()` de propósito: são as duas coisas que TODA escrita
 * precisa lembrar de chamar, e esquecer qualquer uma das duas é falha
 * silenciosa — nada quebra, só a informação passa a mentir. Manter as duas no
 * mesmo arquivo é o que torna óbvio, ao editar um serviço, que faltou uma.
 *
 * Nunca lança: histórico é dado secundário, e derrubar a conclusão de uma
 * tarefa porque o log falhou seria trocar um problema pequeno por um grande.
 */
export function recordEvent(input: {
  projectId: string;
  frontId?: string;
  entityType: ProjectEventEntity;
  entityId: string;
  kind: ProjectEventKind;
  from?: string;
  to?: string;
  at?: string;
}): void {
  try {
    const events = readEvents();
    events.push({
      id: generateId('pevent'),
      projectId: input.projectId,
      frontId: input.frontId,
      entityType: input.entityType,
      entityId: input.entityId,
      kind: input.kind,
      from: input.from,
      to: input.to,
      at: input.at ?? new Date().toISOString(),
    });
    // Descarta os mais antigos primeiro: tendência recente vale mais que
    // história remota, e o teto só existe como rede contra escrita em laço.
    writeEvents(events.length > PROJECT_EVENT_LIMIT ? events.slice(-PROJECT_EVENT_LIMIT) : events);
  } catch {
    // Silêncio proposital — ver comentário acima.
  }
}
