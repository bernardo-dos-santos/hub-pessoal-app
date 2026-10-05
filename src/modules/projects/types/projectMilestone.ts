import { type BaseEntity } from '../../../shared/types/base-entity';

/**
 * Ponto verificável na linha do tempo do projeto.
 *
 * Existe porque contar tarefa é péssima medida de progresso fora de
 * programação: numa viagem, marcar 4 de 10 itens do checklist não significa
 * 40% pronto, e numa campanha de RPG as sessões futuras nem estão
 * cadastradas — o denominador cresce junto com o trabalho, então a
 * porcentagem anda para trás quando o projeto avança.
 *
 * Marco não depende de quantas tarefas existem. "Arco 1 encerrado" é
 * verdadeiro ou falso, e continua significando a mesma coisa em janeiro e em
 * dezembro.
 *
 * Deliberadamente SEM status: um marco foi atingido ou não foi, e `reachedAt`
 * já carrega as duas informações (se foi, e quando). Um enum aqui abriria
 * espaço para estados que ninguém sabe interpretar depois.
 */
export type ProjectMilestone = BaseEntity & {
  projectId: string;
  /** Opcional: marco pode ser do projeto todo, não de uma frente. */
  frontId?: string;
  title: string;
  /** Data planejada (YYYY-MM-DD). Ausente = marco sem prazo, só ordem. */
  targetDate?: string;
  /** Preenchido quando o marco é atingido. Ausente = ainda pendente. */
  reachedAt?: string;
  order: number;
};

/**
 * Marco vencido: tinha data, a data passou e não foi atingido.
 *
 * Mais grave que tarefa vencida — tarefa atrasa, marco vencido significa que
 * o plano do projeto não bateu com a realidade.
 */
export function isMilestoneOverdue(milestone: ProjectMilestone, today: string): boolean {
  if (!milestone.targetDate || milestone.reachedAt) return false;
  return milestone.targetDate < today;
}
