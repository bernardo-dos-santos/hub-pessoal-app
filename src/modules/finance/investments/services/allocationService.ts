import { storageAdapter } from '../../../../core/storage/storage.adapter';
import {
  DEFAULT_TARGET_ALLOCATION,
  SLEEVE_LABEL,
  type AllocationSleeve,
  type Investment,
  type TargetAllocation,
} from '../types/investment';

const KEY_TARGET_ALLOCATION = 'finance.investments.targetAllocation';

export const ALLOCATION_SLEEVES = Object.keys(DEFAULT_TARGET_ALLOCATION) as AllocationSleeve[];

export type SleeveAllocation = {
  sleeve: AllocationSleeve;
  label: string;
  targetPercent: number;
  currentValue: number;
  currentPercent: number;
  /** Quanto essa classe deveria valer hoje, dado o tamanho atual da carteira. */
  targetValue: number;
  /** Positivo = abaixo do alvo. */
  gap: number;
};

export type PortfolioAllocation = {
  total: number;
  sleeves: SleeveAllocation[];
  /** Valor em carteira que ainda não foi classificado numa fatia. */
  unassignedValue: number;
};

export type NextContributionSuggestion = {
  sleeve: AllocationSleeve;
  label: string;
  amount: number;
  reason: string;
};

export function getTargetAllocation(): TargetAllocation {
  return storageAdapter.getItem<TargetAllocation>(KEY_TARGET_ALLOCATION) ?? DEFAULT_TARGET_ALLOCATION;
}

export function setTargetAllocation(target: TargetAllocation): TargetAllocation {
  storageAdapter.setItem(KEY_TARGET_ALLOCATION, target);
  return target;
}

export function isTargetComplete(target: TargetAllocation): boolean {
  const total = ALLOCATION_SLEEVES.reduce((sum, sleeve) => sum + (target[sleeve] ?? 0), 0);
  // Tolerância pra arredondamento de percentual digitado à mão.
  return Math.abs(total - 100) < 0.01;
}

/** Só o bucket `carteira` entra na alocação — reserva tem função própria. */
function portfolioInvestments(investments: Investment[]) {
  return investments.filter((investment) => (investment.bucket ?? 'carteira') === 'carteira');
}

export function calculateAllocation(
  investments: Investment[],
  target: TargetAllocation = getTargetAllocation(),
): PortfolioAllocation {
  const portfolio = portfolioInvestments(investments);
  const total = portfolio.reduce((sum, investment) => sum + investment.currentValue, 0);

  const sleeves = ALLOCATION_SLEEVES.map((sleeve) => {
    const currentValue = portfolio
      .filter((investment) => investment.sleeve === sleeve)
      .reduce((sum, investment) => sum + investment.currentValue, 0);
    const targetPercent = target[sleeve] ?? 0;
    const targetValue = (total * targetPercent) / 100;

    return {
      sleeve,
      label: SLEEVE_LABEL[sleeve],
      targetPercent,
      currentValue,
      currentPercent: total > 0 ? (currentValue / total) * 100 : 0,
      targetValue,
      gap: targetValue - currentValue,
    };
  });

  return {
    total,
    sleeves,
    unassignedValue: portfolio
      .filter((investment) => !investment.sleeve)
      .reduce((sum, investment) => sum + investment.currentValue, 0),
  };
}

/**
 * Um destino por mês: o aporte inteiro vai pra classe mais atrasada.
 *
 * Fatiar R$500 em quatro vira R$125 em cada — valor que não compra nada
 * relevante e paga taxa quatro vezes. Concentrar num destino por vez chega na
 * mesma alocação em poucos meses, com menos fricção.
 *
 * O atraso é medido contra a carteira *depois* do aporte, não contra a de hoje:
 * senão, com a carteira vazia todos os alvos valem zero e não haveria como
 * escolher o primeiro destino.
 */
export function suggestNextContribution(
  investments: Investment[],
  contributionAmount: number,
  target: TargetAllocation = getTargetAllocation(),
): NextContributionSuggestion | null {
  if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) return null;

  const { total, sleeves } = calculateAllocation(investments, target);
  const totalAfter = total + contributionAmount;

  const ranked = sleeves
    .map((sleeve) => ({
      ...sleeve,
      gapAfter: (totalAfter * sleeve.targetPercent) / 100 - sleeve.currentValue,
    }))
    .filter((sleeve) => sleeve.targetPercent > 0)
    .sort((first, second) => second.gapAfter - first.gapAfter);

  const winner = ranked[0];
  if (!winner || winner.gapAfter <= 0) return null;

  const reason =
    total === 0
      ? `Carteira zerada — começa pela maior fatia do plano (${winner.targetPercent}%).`
      : `Está em ${winner.currentPercent.toFixed(1)}% da carteira, alvo ${winner.targetPercent}% — a fatia mais atrasada.`;

  return {
    sleeve: winner.sleeve,
    label: winner.label,
    amount: contributionAmount,
    reason,
  };
}

export const allocationService = {
  getTargetAllocation,
  setTargetAllocation,
  isTargetComplete,
  calculateAllocation,
  suggestNextContribution,
};
