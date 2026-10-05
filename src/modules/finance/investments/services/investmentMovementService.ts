import { storageAdapter } from '../../../../core/storage/storage.adapter';
import { generateId } from '../../../../shared/utils/generateId';
import {
  type InvestmentMovement,
  type InvestmentMovementType,
  type InvestmentPosition,
} from '../types/movement';

const KEY_MOVEMENTS = 'finance.investments.movements';

export type InvestmentMovementInput = Omit<InvestmentMovement, 'id' | 'createdAt'>;

function readMovements(): InvestmentMovement[] {
  return storageAdapter.getItem<InvestmentMovement[]>(KEY_MOVEMENTS) ?? [];
}

function writeMovements(movements: InvestmentMovement[]) {
  storageAdapter.setItem(KEY_MOVEMENTS, movements);
}

/** Valor do movimento em real. Ativo em real tem câmbio 1. */
function amountInBrl(movement: InvestmentMovement) {
  return Math.abs(movement.amount) * (movement.exchangeRate ?? 1);
}

function byDateAsc(first: InvestmentMovement, second: InvestmentMovement) {
  return first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt);
}

/**
 * Reduz os movimentos de um ativo à posição atual.
 *
 * `totalInvested` é dinheiro que entrou menos o que saiu, cada parcela
 * convertida pelo câmbio do próprio dia — por isso o câmbio mora no movimento,
 * não no ativo. `currentValue` é a última marcação a mercado; sem nenhuma, cai
 * pro total aportado (que é o que o ativo vale até prova em contrário).
 */
export function calculatePosition(movements: InvestmentMovement[]): InvestmentPosition {
  const ordered = [...movements].sort(byDateAsc);

  let totalInvested = 0;
  let totalInvestedInAssetCurrency = 0;
  let quantity = 0;
  let lastValuation: InvestmentMovement | null = null;

  for (const movement of ordered) {
    if (movement.type === 'contribution') {
      totalInvested += amountInBrl(movement);
      totalInvestedInAssetCurrency += Math.abs(movement.amount);
      quantity += movement.quantity ?? 0;
    } else if (movement.type === 'withdrawal') {
      totalInvested -= amountInBrl(movement);
      totalInvestedInAssetCurrency -= Math.abs(movement.amount);
      quantity -= movement.quantity ?? 0;
    } else {
      lastValuation = movement;
      // Marcação pode trazer a quantidade real da corretora, que corrige
      // desdobramento/bonificação que nenhum aporte registrou.
      if (movement.quantity !== undefined) quantity = movement.quantity;
    }
  }

  return {
    totalInvested,
    totalInvestedInAssetCurrency,
    currentValue: lastValuation ? amountInBrl(lastValuation) : totalInvested,
    currentValueInAssetCurrency: lastValuation ? Math.abs(lastValuation.amount) : totalInvestedInAssetCurrency,
    quantity,
    lastValuationDate: lastValuation?.date ?? null,
    movementCount: ordered.length,
  };
}

export const investmentMovementService = {
  listMovements(): InvestmentMovement[] {
    return [...readMovements()].sort((first, second) => -byDateAsc(first, second));
  },

  listByInvestment(investmentId: string): InvestmentMovement[] {
    return readMovements()
      .filter((movement) => movement.investmentId === investmentId)
      .sort((first, second) => -byDateAsc(first, second));
  },

  getPosition(investmentId: string): InvestmentPosition {
    return calculatePosition(readMovements().filter((movement) => movement.investmentId === investmentId));
  },

  create(input: InvestmentMovementInput): InvestmentMovement {
    if (!input.investmentId) throw new Error('Movimento precisa de um investimento.');
    if (!Number.isFinite(input.amount) || input.amount === 0) throw new Error('Movimento precisa de um valor.');

    const movement: InvestmentMovement = {
      ...input,
      amount: Math.abs(input.amount),
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    writeMovements([movement, ...readMovements()]);
    return movement;
  },

  /**
   * Registra o movimento só se o `externalId` ainda não existir. É o que
   * mantém o resync da Pluggy idempotente sem sobrescrever histórico: rodar o
   * sync duas vezes no mesmo dia não cria duas marcações.
   */
  createIfNew(input: InvestmentMovementInput): InvestmentMovement | null {
    if (!input.externalId) return this.create(input);

    const exists = readMovements().some((movement) => movement.externalId === input.externalId);
    return exists ? null : this.create(input);
  },

  remove(id: string): void {
    writeMovements(readMovements().filter((movement) => movement.id !== id));
  },

  removeByInvestment(investmentId: string): number {
    const movements = readMovements();
    const remaining = movements.filter((movement) => movement.investmentId !== investmentId);
    writeMovements(remaining);
    return movements.length - remaining.length;
  },

  /** Total aportado no período, para acompanhar a meta mensal de aporte. */
  totalContributedBetween(startDate: string, endDate: string): number {
    return readMovements()
      .filter(
        (movement) =>
          movement.type === 'contribution' && movement.date >= startDate && movement.date <= endDate,
      )
      .reduce((total, movement) => total + amountInBrl(movement), 0);
  },

  countByType(type: InvestmentMovementType): number {
    return readMovements().filter((movement) => movement.type === type).length;
  },

  clearMovements(): void {
    storageAdapter.removeItem(KEY_MOVEMENTS);
  },
};
