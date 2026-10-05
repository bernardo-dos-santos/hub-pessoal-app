import {
  type MonthlyCategoryComparison,
  type MonthlyCategoryComparisonDetails,
  type MonthlyCategoryComparisonTransaction,
  type MonthlyEvolutionPoint,
  type MonthlyComparisonDelta,
  type MonthlyFinanceComparison,
  type MonthlyFinanceSummary,
} from '../types/finance';
import {
  calculateFinanceSummary,
  calculateNetExpensesByCategory,
  filterTransactionsBySelectedMonth,
  getNetExpenseCategoryTransactions,
  getNetExpenseSignedAmount,
  getMonthKey,
  type MonthSelection,
} from '../utils/financeCalculations';
import { formatMonthLabel, getPreviousMonthKey } from '../utils/financePeriod';
import { transactionService } from './transactionService';

function percentChange(currentValue: number, previousValue: number) {
  return previousValue === 0 ? null : ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
}

function createDelta(currentValue: number, previousValue: number): MonthlyComparisonDelta {
  return {
    currentValue,
    previousValue,
    difference: currentValue - previousValue,
    percentChange: percentChange(currentValue, previousValue),
  };
}

function createCountDelta(currentValue: number, previousValue: number) {
  return {
    currentValue,
    previousValue,
    difference: currentValue - previousValue,
  };
}

function compareCategoryExpenses(selectedMonth: string): MonthlyCategoryComparison[] {
  const previousMonth = getPreviousMonthKey(selectedMonth);
  const currentExpenses = calculateNetExpensesByCategory(transactionService.listTransactions(), selectedMonth);
  const previousExpenses = calculateNetExpensesByCategory(transactionService.listTransactions(), previousMonth);
  const currentByCategory = new Map(currentExpenses.map((item) => [item.category, item]));
  const previousByCategory = new Map(previousExpenses.map((item) => [item.category, item]));
  const categories = new Set([...currentByCategory.keys(), ...previousByCategory.keys()]);

  return [...categories]
    .map((category) => {
      const current = currentByCategory.get(category);
      const previous = previousByCategory.get(category);
      const currentAmount = current?.amount ?? 0;
      const previousAmount = previous?.amount ?? 0;

      return {
        category,
        currentAmount,
        previousAmount,
        difference: currentAmount - previousAmount,
        percentChange: percentChange(currentAmount, previousAmount),
        currentTransactionCount: current?.transactionsCount ?? 0,
        previousTransactionCount: previous?.transactionsCount ?? 0,
      };
    })
    .filter((item) => item.currentAmount !== 0 || item.previousAmount !== 0)
    .sort((first, second) => Math.abs(second.difference) - Math.abs(first.difference) || second.currentAmount - first.currentAmount);
}

function mapComparisonTransaction(transaction: ReturnType<typeof transactionService.listTransactions>[number]): MonthlyCategoryComparisonTransaction {
  return {
    id: transaction.id,
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    category: transaction.category,
    kind: transaction.kind,
    account: transaction.accountName,
    source: transaction.source,
    isRefund: transaction.kind === 'refund',
    isCardPurchase: transaction.kind === 'card_purchase',
    isExpense: transaction.kind === 'expense',
  };
}

function sumNetTransactions(transactions: ReturnType<typeof transactionService.listTransactions>) {
  return transactions.reduce((total, transaction) => total + getNetExpenseSignedAmount(transaction), 0);
}

export const financeSummaryService = {
  getFinanceSummary(selectedMonth?: MonthSelection): MonthlyFinanceSummary {
    const month = getMonthKey(selectedMonth);
    const transactions = filterTransactionsBySelectedMonth(transactionService.listTransactions(), month);

    return {
      ...calculateFinanceSummary(transactions),
      month,
      requiredReviewCount: filterTransactionsBySelectedMonth(transactionService.listRequiredReviewTransactions(), month).length,
      optionalCheckCount: filterTransactionsBySelectedMonth(transactionService.listOptionalCheckTransactions(), month).length,
    };
  },

  getCategoryExpenses(selectedMonth?: MonthSelection) {
    return calculateNetExpensesByCategory(transactionService.listTransactions(), selectedMonth);
  },

  getMonthlyComparison(selectedMonth?: MonthSelection): MonthlyFinanceComparison {
    const currentMonth = getMonthKey(selectedMonth);
    const previousMonth = getPreviousMonthKey(currentMonth);
    const currentSummary = this.getFinanceSummary(currentMonth);
    const previousSummary = this.getFinanceSummary(previousMonth);

    return {
      currentMonth,
      previousMonth,
      currentSummary,
      previousSummary,
      deltas: {
        income: createDelta(currentSummary.income, previousSummary.income),
        expenses: createDelta(currentSummary.expenses, previousSummary.expenses),
        balance: createCountDelta(currentSummary.balance, previousSummary.balance),
        cardPurchases: createDelta(currentSummary.cardPurchases, previousSummary.cardPurchases),
        transactionCount: createCountDelta(currentSummary.transactionCount, previousSummary.transactionCount),
      },
    };
  },

  getMonthlyEvolution(selectedMonth?: MonthSelection, monthsCount = 6): MonthlyEvolutionPoint[] {
    const lastMonth = getMonthKey(selectedMonth);
    const months = [lastMonth];

    while (months.length < monthsCount) {
      months.unshift(getPreviousMonthKey(months[0]));
    }

    return months.map((month) => {
      const summary = this.getFinanceSummary(month);

      return {
        month,
        label: formatMonthLabel(month),
        income: summary.income,
        expenses: summary.netExpenses,
        balance: summary.balance,
        transactionCount: summary.transactionCount,
      };
    });
  },

  getMonthlyCategoryComparison(selectedMonth?: MonthSelection) {
    return compareCategoryExpenses(getMonthKey(selectedMonth));
  },

  getMonthlyCategoryComparisonDetails(selectedMonth: MonthSelection, category: string): MonthlyCategoryComparisonDetails {
    const currentMonth = getMonthKey(selectedMonth);
    const previousMonth = getPreviousMonthKey(currentMonth);
    const transactions = transactionService.listTransactions();
    const currentTransactions = getNetExpenseCategoryTransactions(transactions, category, currentMonth);
    const previousTransactions = getNetExpenseCategoryTransactions(transactions, category, previousMonth);
    const currentAmount = sumNetTransactions(currentTransactions);
    const previousAmount = sumNetTransactions(previousTransactions);

    return {
      category,
      currentMonth,
      previousMonth,
      currentLabel: formatMonthLabel(currentMonth),
      previousLabel: formatMonthLabel(previousMonth),
      currentAmount,
      previousAmount,
      difference: currentAmount - previousAmount,
      percentChange: percentChange(currentAmount, previousAmount),
      currentTransactionCount: currentTransactions.length,
      previousTransactionCount: previousTransactions.length,
      currentTransactions: currentTransactions.map(mapComparisonTransaction),
      previousTransactions: previousTransactions.map(mapComparisonTransaction),
    };
  },
};
