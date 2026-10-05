import { type BaseEntity } from '../../../shared/types/base-entity';

export type ProjectStatus = 'active' | 'paused' | 'done' | 'archived';

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  done: 'Concluído',
  archived: 'Arquivado',
};

/**
 * Natureza do projeto — decide quais recursos a interface oferece.
 *
 * O módulo nasceu para um projeto só (o próprio Hub) e o viés vazou: escopo
 * git em toda frente, seletor de repositório em toda criação. Fora de
 * programação isso é campo sem sentido ocupando o lugar mais visível do
 * formulário. `kind` é o que permite esconder o que é de código sem manter
 * duas telas paralelas.
 */
export type ProjectKind = 'code' | 'personal' | 'creative' | 'study' | 'health' | 'other';

export const PROJECT_KIND_LABEL: Record<ProjectKind, string> = {
  code: 'Código',
  personal: 'Casa e vida pessoal',
  creative: 'Criativo',
  study: 'Estudo e concurso',
  health: 'Saúde e treino',
  other: 'Outro',
};

/** Só projeto de código expõe repositório, escopo de commit e aba de atividade. */
export function isCodeProject(project: Pick<Project, 'kind' | 'repoId'>): boolean {
  return resolveKind(project) === 'code';
}

/**
 * Natureza efetiva de um projeto criado antes deste campo existir.
 *
 * Backfill preguiçoso, na leitura: quem tem repositório vinculado era projeto
 * de código, o resto vira `other`. Evita script de migração destrutivo num
 * banco que mora no PC dedicado e não tem ensaio barato.
 */
export function resolveKind(project: Pick<Project, 'kind' | 'repoId'>): ProjectKind {
  if (project.kind) return project.kind;
  return project.repoId != null ? 'code' : 'other';
}

export type Project = BaseEntity & {
  name: string;
  description?: string;
  status: ProjectStatus;
  /**
   * Ausente nos projetos criados antes deste campo — nunca ler direto, sempre
   * por `resolveKind()`, que resolve o caso legado.
   */
  kind?: ProjectKind;
  startedAt: string;
  /** Opcional: projeto criativo nem sempre tem prazo. */
  targetDate?: string;
  completedAt?: string;
  /**
   * Atualizado por QUALQUER escrita no projeto (tarefa, frente, edição).
   * É daqui que sai a cobrança "parado há X dias" — se parar de ser atualizado,
   * o projeto parece vivo enquanto ninguém encosta nele.
   */
  lastActivityAt: string;
  /** Dias sem atividade até virar alerta. Ausente = usa o padrão global. */
  nudgeAfterDays?: number;
  /**
   * Próxima ação entre as tarefas SEM frente. Mesmo papel do campo homônimo
   * em `Front` — projeto simples, que vive só de tarefas soltas, também
   * precisa de um passo apontado.
   */
  nextActionTaskId?: string;
  /**
   * Id numérico do repositório no GitHub — escolhido na criação, a partir do
   * que a API do GitHub lista pra este usuário. Ausente = projeto sem git
   * (não é código, ou não rastreado). Âncora de identidade de verdade: não
   * muda nem se o repositório for renomeado (diferente de um caminho local
   * ou de uma URL, que mudam). Alimenta a página Atividade e a camada 1
   * (commit → frente automático).
   */
  repoId?: number;
  /**
   * Nome de exibição "dono/repositório", em cache — evita ida na API só pra
   * mostrar o nome. Atualizado sozinho sempre que a Atividade resolve o
   * `repoId` com sucesso, então um rename no GitHub se autocorrige aqui na
   * próxima visita, sem o usuário precisar fazer nada.
   */
  repoName?: string;
};

/** Depois de quantos dias parados um projeto vira alerta, quando não configurado. */
export const DEFAULT_NUDGE_AFTER_DAYS = 14;
