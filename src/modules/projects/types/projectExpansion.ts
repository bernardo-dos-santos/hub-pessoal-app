import { type BaseEntity } from '../../../shared/types/base-entity';

/**
 * Categoria da ideia — texto livre, definido por quem escreve.
 *
 * Era uma união fechada em `jarvis | concurso | gamificacao | seguranca |
 * infraestrutura | ...`, que são as categorias DO HUB. Num projeto de reforma
 * ou numa campanha de RPG esse vocabulário não significa nada, e com outros
 * usuários entrando ele deixaria de ser um incômodo e viraria lixo obrigatório.
 * Texto livre com sugestões do que o projeto já usa resolve os dois casos sem
 * impor o vocabulário de ninguém.
 */
export type ExpansionCategory = string;

/**
 * Rótulos das categorias usadas enquanto o campo era fechado — mantidos só
 * para que as ideias já cadastradas continuem exibindo o nome por extenso em
 * vez do slug cru. Não é lista de opções: nada novo deve ser adicionado aqui.
 */
const LEGACY_CATEGORY_LABEL: Record<string, string> = {
  jarvis: 'Jarvis & Automação',
  concurso: 'Preparação para concurso',
  gamificacao: 'Gamificação',
  seguranca: 'Segurança & Rede',
  infraestrutura: 'Infraestrutura',
  especulativa: 'Ramificações especulativas',
  outros: 'Complementos sugeridos',
};

export function expansionCategoryLabel(category: ExpansionCategory): string {
  return LEGACY_CATEGORY_LABEL[category] ?? category;
}

/** Categoria vazia cai aqui, para a ideia nunca ficar fora de um agrupamento. */
export const DEFAULT_EXPANSION_CATEGORY = 'Sem categoria';

export type ExpansionComplexity = 'low' | 'medium' | 'high';

export const EXPANSION_COMPLEXITY_LABEL: Record<ExpansionComplexity, string> = {
  low: 'baixa',
  medium: 'média',
  high: 'alta',
};

/** Veredito técnico de viabilidade — checado contra o código/infra reais, não uma opinião solta. */
export type ExpansionFeasibility = 'viable' | 'caveats' | 'not_viable';

export const EXPANSION_FEASIBILITY_LABEL: Record<ExpansionFeasibility, string> = {
  viable: 'Viável',
  caveats: 'Viável com ressalvas',
  not_viable: 'Não viável hoje',
};

export type ExpansionStatus = 'backlog' | 'implemented' | 'promoted' | 'discarded';

export const EXPANSION_STATUS_LABEL: Record<ExpansionStatus, string> = {
  backlog: 'Backlog',
  implemented: 'Já implementada',
  promoted: 'Virou frente/tarefa',
  discarded: 'Descartada',
};

/**
 * Ideia especulativa de expansão do Hub — backlog de longo prazo, não o
 * trabalho corrente de um projeto. Deliberadamente SEPARADA de ProjectIssue:
 * issue é algo notado de passagem sobre o que já existe; expansão é uma
 * feature nova ainda não decidida, com veredito de viabilidade próprio antes
 * de qualquer trabalho começar.
 */
export type ProjectExpansion = BaseEntity & {
  projectId: string;
  title: string;
  description?: string;
  category: ExpansionCategory;
  complexity: ExpansionComplexity;
  status: ExpansionStatus;
  /** Ausente = ainda não avaliada. */
  feasibility?: ExpansionFeasibility;
  feasibilityNote?: string;
};
