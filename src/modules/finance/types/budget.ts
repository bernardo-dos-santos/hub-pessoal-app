import { type FinanceScope } from './finance';

export type BudgetPeriod = 'monthly';

export type Budget = {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  limit: number;
  categories?: string[];
  amount?: number;
  scope: FinanceScope;
  period: BudgetPeriod;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BudgetUsage = {
  budgetId: string;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: 'ok' | 'attention' | 'exceeded';
  transactionsCount: number;
};

export type BudgetsSummary = {
  totalActive: number;
  withinLimit: number;
  attention: number;
  exceeded: number;
  totalLimit: number;
  totalSpent: number;
  totalRemaining: number;
};

export type BudgetStatus = BudgetUsage & {
  percent: number;
  state: 'inside' | 'attention' | 'over';
};
