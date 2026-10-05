import { type BaseEntity } from '../../../shared/types/base-entity';

export type IssueKind = 'bug' | 'improvement' | 'idea';
export type IssueSeverity = 'low' | 'medium' | 'high';
export type IssueStatus = 'open' | 'planned' | 'done' | 'wontfix';

export const ISSUE_KIND_LABEL: Record<IssueKind, string> = {
  bug: 'Bug',
  improvement: 'Melhoria',
  idea: 'Ideia',
};

export const ISSUE_SEVERITY_LABEL: Record<IssueSeverity, string> = {
  low: 'baixa',
  medium: 'média',
  high: 'alta',
};

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'Aberto',
  planned: 'Planejado',
  done: 'Resolvido',
  wontfix: 'Não vou fazer',
};

/**
 * Ponto de melhoria, bug ou ideia — o inbox do projeto.
 *
 * Deliberadamente SEPARADO de ProjectTask. Tarefa é trabalho decidido: entra no
 * plano e conta no progresso. Issue é algo notado de passagem, que talvez nunca
 * vire trabalho. Se as duas dividissem a mesma lista, anotar cinco melhorias
 * derrubaria o percentual do projeto como se o escopo tivesse crescido — e o
 * efeito prático seria parar de anotar pra não "sujar" a métrica.
 */
export type ProjectIssue = BaseEntity & {
  projectId: string;
  /** Opcional: nem toda melhoria pertence a uma frente. */
  frontId?: string;
  kind: IssueKind;
  title: string;
  detail?: string;
  severity?: IssueSeverity;
  status: IssueStatus;
  /** Preenchido quando a issue vira trabalho de verdade. */
  promotedTaskId?: string;
};

export function isIssueOpen(issue: ProjectIssue): boolean {
  return issue.status === 'open' || issue.status === 'planned';
}
