import { type BaseEntity } from '../../../shared/types/base-entity';

export type FrontStatus = 'active' | 'paused' | 'done';

export const FRONT_STATUS_LABEL: Record<FrontStatus, string> = {
  active: 'Ativa',
  paused: 'Pausada',
  done: 'Concluída',
};

/**
 * Em que fase a frente está — a pergunta que a porcentagem esconde.
 *
 * `figuring` é trabalho em que ainda não se sabe COMO fazer; `executing` é
 * quando já se sabe e falta fazer. Uma frente em 0% por não ter caminho
 * definido e outra em 0% por ter muito volume pela frente são situações
 * completamente diferentes, e "0%" conta a mesma história para as duas.
 *
 * Ausente = nunca foi classificada; a interface não inventa um palpite.
 */
export type FrontPhase = 'figuring' | 'executing';

export const FRONT_PHASE_LABEL: Record<FrontPhase, string> = {
  figuring: 'descobrindo',
  executing: 'executando',
};

/**
 * Frente de batalha — a unidade de trabalho paralela dentro de um projeto.
 *
 * Sem `order` de propósito: ordem sugere sequência, e o ponto de uma frente é
 * justamente correr junto das outras. Fase sequencial é caso particular (uma
 * frente com tarefas ordenadas), não o contrário.
 */
export type Front = BaseEntity & {
  projectId: string;
  name: string;
  status: FrontStatus;
  /** Cobrança é por frente, não só por projeto: uma pode parar com o resto ativo. */
  lastActivityAt: string;
  /**
   * Escopo do Conventional Commit que alimenta esta frente (ex.: "projects"
   * pra bater com `feat(projects): ...`). Opcional — só frentes que
   * representam trabalho neste próprio repositório fazem sentido linkar.
   */
  gitScope?: string;
  /**
   * A única tarefa que importa agora nesta frente.
   *
   * Projeto não trava por falta de vontade, e sim porque o próximo passo
   * concreto não está definido — uma lista de 14 itens intocados produz mais
   * paralisia, não menos. Apontar UMA tarefa é o que transforma a tela de
   * diagnóstico ("parado há 15 dias") em tratamento.
   */
  nextActionTaskId?: string;
  phase?: FrontPhase;
};
