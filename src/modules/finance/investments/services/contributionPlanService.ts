import { type Investment, type TargetAllocation } from '../types/investment';
import { reserveService, type ReserveStatus } from './reserveService';
import { allocationService, type NextContributionSuggestion } from './allocationService';

export type ContributionSplit = {
  totalAmount: number;
  reserveAmount: number;
  portfolioAmount: number;
  /** Null quando não há prazo definido — divisão automática fica desligada. */
  monthsToDeadline: number | null;
  /** Quanto precisaria ir pra reserva por mês pra fechar a meta no prazo. */
  neededPerMonthForReserve: number | null;
  /** Prazo definido, mas o aporte atual não fecha a meta nele. */
  feasible: boolean;
  /** Quanto falta por mês pra caber no prazo, quando `feasible` é falso. */
  shortfallPerMonth: number | null;
  reserveComplete: boolean;
  /** Sem prazo definido, ou sem gasto suficiente pra medir a reserva em meses. */
  deadlineActive: boolean;
};

/** Meses de calendário entre hoje e a data-alvo, no mínimo 1. */
function monthsUntil(deadline: string): number {
  const now = new Date();
  const target = new Date(deadline);
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

/**
 * Divide o aporte mensal entre reserva e carteira a partir de um prazo, não
 * de uma proporção fixa. "70/30" não quer dizer nada por si só; "quero a
 * reserva pronta em 2 anos" é uma frase que dá pra sentir, e o app calcula o
 * 70/30 correspondente sozinho — recalculando a cada mês conforme o gasto e o
 * saldo da reserva mudam.
 *
 * Sem prazo definido, o aporte inteiro segue pra carteira (comportamento de
 * antes desta função existir) — dividir sem um prazo escolhido pelo usuário
 * seria inventar uma meta que ele não pediu.
 */
export function calculateContributionSplit(
  reserve: ReserveStatus,
  monthlyContribution: number,
  deadline: string | null,
): ContributionSplit {
  const base: ContributionSplit = {
    totalAmount: monthlyContribution,
    reserveAmount: 0,
    portfolioAmount: monthlyContribution,
    monthsToDeadline: null,
    neededPerMonthForReserve: null,
    feasible: true,
    shortfallPerMonth: null,
    reserveComplete: reserve.gap !== null && reserve.gap <= 0,
    deadlineActive: false,
  };

  if (!Number.isFinite(monthlyContribution) || monthlyContribution <= 0) return base;
  if (!deadline || reserve.gap === null) return base;
  if (reserve.gap <= 0) return { ...base, reserveComplete: true };

  const monthsToDeadline = monthsUntil(deadline);
  const neededPerMonthForReserve = reserve.gap / monthsToDeadline;
  const feasible = neededPerMonthForReserve <= monthlyContribution;
  const reserveAmount = Math.min(neededPerMonthForReserve, monthlyContribution);

  return {
    totalAmount: monthlyContribution,
    reserveAmount,
    portfolioAmount: monthlyContribution - reserveAmount,
    monthsToDeadline,
    neededPerMonthForReserve,
    feasible,
    shortfallPerMonth: feasible ? null : neededPerMonthForReserve - monthlyContribution,
    reserveComplete: false,
    deadlineActive: true,
  };
}

export type ContributionPlan = {
  split: ContributionSplit;
  /** Sugestão dentro da carteira, já usando só a fatia destinada a ela. */
  portfolioSuggestion: NextContributionSuggestion | null;
};

/** Junta a divisão reserva×carteira com "pra onde vai" dentro da carteira. */
export function suggestContributionPlan(
  investments: Investment[],
  monthlyContribution: number,
  target?: TargetAllocation,
): ContributionPlan {
  const reserve = reserveService.calculateReserveStatus(investments);
  const deadline = reserveService.getReserveDeadline();
  const split = calculateContributionSplit(reserve, monthlyContribution, deadline);

  return {
    split,
    portfolioSuggestion: allocationService.suggestNextContribution(investments, split.portfolioAmount, target),
  };
}

export const contributionPlanService = {
  calculateContributionSplit,
  suggestContributionPlan,
};
