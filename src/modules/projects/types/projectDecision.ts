import { type BaseEntity } from '../../../shared/types/base-entity';

/**
 * Decisão tomada no projeto.
 *
 * O campo que carrega o valor é o `why` — e, logo depois, o `discarded`.
 * "O que a gente decidiu" costuma sobreviver no código; "por que" e "o que foi
 * tentado e rejeitado" evaporam em semanas, e é isso que faz a mesma discussão
 * voltar do zero e a mesma alternativa ruim ser proposta de novo.
 */
export type ProjectDecision = BaseEntity & {
  projectId: string;
  /** Opcional: decisão pode ser do projeto todo, não de uma frente. */
  frontId?: string;
  title: string;
  /** Por que se decidiu assim. Obrigatório de propósito — sem isso o registro não serve. */
  why: string;
  /** O que foi considerado e descartado, e idealmente por quê. */
  discarded?: string;
  /** Data da decisão (YYYY-MM-DD) — separada de createdAt pra permitir registrar em atraso. */
  decidedOn: string;
  /** Marcada quando a decisão for revertida ou substituída por outra. */
  supersededById?: string;
};
