import { storageAdapter } from '../../../../core/storage/storage.adapter';
import { generateId } from '../../../../shared/utils/generateId';
import { calculatePosition } from '../../../../shared/finance/investmentPosition.js';
import { type InvestmentMovement, type InvestmentPosition } from '../types/movement';

export { calculatePosition };

const KEY_MOVEMENTS = 'finance.investments.movements';

export type InvestmentMovementInput = Omit<InvestmentMovement, 'id' | 'createdAt'>;

function readMovements(): InvestmentMovement[] {
  return storageAdapter.getItem<InvestmentMovement[]>(KEY_MOVEMENTS) ?? [];
}

function writeMovements(movements: InvestmentMovement[]) {
  storageAdapter.setItem(KEY_MOVEMENTS, movements);
}

function byDateAsc(first: InvestmentMovement, second: InvestmentMovement) {
  return first.date.localeCompare(second.date) || first.createdAt.localeCompare(second.createdAt);
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

  remove(id: string): void {
    writeMovements(readMovements().filter((movement) => movement.id !== id));
  },

  removeByInvestment(investmentId: string): number {
    const movements = readMovements();
    const remaining = movements.filter((movement) => movement.investmentId !== investmentId);
    writeMovements(remaining);
    return movements.length - remaining.length;
  },

};
