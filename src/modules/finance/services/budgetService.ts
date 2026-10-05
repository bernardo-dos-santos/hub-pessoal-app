import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { defaultBudgets } from '../data/defaultBudgets';
import { type Budget, type BudgetPeriod, type BudgetUsage, type BudgetsSummary } from '../types/budget';
import { type FinanceScope } from '../types/finance';
import { type Transaction } from '../types/transaction';
import {
  calculateBudgetStatus,
  calculateBudgetUsage,
  calculateBudgetsSummary,
  getBudgetTransactions,
  type BudgetMonthSelection,
} from '../utils/financeCalculations';

const budgetsStorageKey = 'finance.budgets';

let memoryBudgets: Budget[] | null = null;

export type BudgetInput = {
  name: string;
  category: string;
  categoryId?: string;
  limit: number;
  scope: FinanceScope;
  period?: BudgetPeriod;
  isActive?: boolean;
};

function readBudgets() {
  return (storageAdapter.getItem<Budget[]>(budgetsStorageKey) ?? memoryBudgets ?? []).map(normalizeBudget);
}

function writeBudgets(budgets: Budget[]) {
  memoryBudgets = budgets;
  storageAdapter.setItem(budgetsStorageKey, budgets);
}

function validatedBudgetInput(input: BudgetInput) {
  const name = input.name.trim();
  const category = input.category.trim();
  const limit = Number(input.limit);

  if (!name) {
    throw new Error('O nome do orcamento nao pode ficar vazio.');
  }

  if (!category) {
    throw new Error('A categoria do orcamento nao pode ficar vazia.');
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('O limite do orcamento deve ser maior que zero.');
  }

  return { ...input, name, category, limit };
}

function normalizeBudget(budget: Budget): Budget {
  return {
    ...budget,
    category: budget.category || budget.categories?.[0] || budget.name,
    limit: budget.limit ?? budget.amount ?? 0,
    isActive: budget.isActive ?? true,
  };
}

export const budgetService = {
  listBudgets(): Budget[] {
    return readBudgets();
  },

  listActiveBudgets(): Budget[] {
    return readBudgets().filter((budget) => budget.isActive);
  },

  listDefaultBudgetSuggestions(): Budget[] {
    return [...defaultBudgets];
  },

  getBudgetById(id: string): Budget | null {
    return readBudgets().find((budget) => budget.id === id) ?? null;
  },

  createBudget(input: BudgetInput): Budget {
    const normalizedInput = validatedBudgetInput(input);
    const now = new Date().toISOString();
    const budget: Budget = {
      id: generateId(),
      name: normalizedInput.name,
      category: normalizedInput.category,
      categoryId: normalizedInput.categoryId,
      limit: normalizedInput.limit,
      scope: normalizedInput.scope,
      period: normalizedInput.period ?? 'monthly',
      isActive: normalizedInput.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    writeBudgets([budget, ...readBudgets()]);
    return budget;
  },

  updateBudget(id: string, updates: Partial<BudgetInput>): Budget | null {
    const currentBudget = this.getBudgetById(id);

    if (!currentBudget) {
      return null;
    }

    const normalizedInput = validatedBudgetInput({
      name: updates.name ?? currentBudget.name,
      category: updates.category ?? currentBudget.category,
      categoryId: updates.categoryId ?? currentBudget.categoryId,
      limit: updates.limit ?? currentBudget.limit,
      scope: updates.scope ?? currentBudget.scope,
      period: updates.period ?? currentBudget.period,
      isActive: updates.isActive ?? currentBudget.isActive,
    });

    let updatedBudget: Budget | null = null;
    const nextBudgets = readBudgets().map((budget) => {
      if (budget.id !== id) {
        return budget;
      }

      updatedBudget = {
        ...budget,
        ...normalizedInput,
        updatedAt: new Date().toISOString(),
      };

      return updatedBudget;
    });

    writeBudgets(nextBudgets);
    return updatedBudget;
  },

  deleteBudget(id: string): boolean {
    const budgets = readBudgets();
    const nextBudgets = budgets.filter((budget) => budget.id !== id);

    if (nextBudgets.length === budgets.length) {
      return false;
    }

    writeBudgets(nextBudgets);
    return true;
  },

  toggleBudget(id: string): Budget | null {
    const budget = this.getBudgetById(id);
    return budget ? this.updateBudget(id, { isActive: !budget.isActive }) : null;
  },

  getBudgetUsage(budget: Budget, transactions: Transaction[], selectedMonth?: BudgetMonthSelection): BudgetUsage {
    return calculateBudgetUsage(budget, transactions, selectedMonth);
  },

  getBudgetStatus(budget: Budget, transactions: Transaction[], selectedMonth?: BudgetMonthSelection) {
    return calculateBudgetStatus(budget, transactions, selectedMonth);
  },

  getBudgetTransactions(budget: Budget, transactions: Transaction[], selectedMonth?: BudgetMonthSelection) {
    return getBudgetTransactions(budget, transactions, selectedMonth);
  },

  getBudgetsSummary(transactions: Transaction[], selectedMonth?: BudgetMonthSelection): BudgetsSummary {
    return calculateBudgetsSummary(this.listActiveBudgets(), transactions, selectedMonth);
  },

  seedDefaultBudgets(): Budget[] {
    writeBudgets([...defaultBudgets]);
    return this.listBudgets();
  },

  clearBudgets(): void {
    memoryBudgets = null;
    storageAdapter.removeItem(budgetsStorageKey);
  },
};
