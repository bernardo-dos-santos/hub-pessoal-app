import { type Budget, type BudgetStatus, type BudgetsSummary, type BudgetUsage } from '../types/budget';
import { type FinanceScope, type FinanceSummary } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { specialCategories } from '../data/specialCategories';
import { getCurrentMonthKey, getMonthStartDay, isValidMonthKey } from './financePeriod';
import { financialMonthOf, isInFinancialMonth } from '../../../shared/finance/financeMonth.js';
import {
  isCategorySpendTransaction,
  isMatchedReimbursement,
  isRealExpense,
  isRealIncome,
  isReviewPlaceholderCategory,
  isSafeExpenseRefund,
  isSameCategory,
  netExpenseSignedAmount,
} from '../../../shared/finance/financeTotals.js';

// What counts as income/spending is shared with the server (financeTotals.js).
export { isMatchedReimbursement, isRealExpense, isRealIncome, isSafeExpenseRefund };

/** Above this share of the limit a budget is "em atenção" — the screen and the alert agree. */
export const BUDGET_ATTENTION_PERCENT = 80;

export const incomeReviewCategory = specialCategories.incomeReview;
export const expenseReviewCategory = specialCategories.expenseReview;
export const internalTransferCategory = specialCategories.internalTransfer;
function absoluteAmount(value: number) {
  return Math.abs(Number(value) || 0);
}

function isCategory(transaction: Pick<Transaction, 'category'>, category: string) {
  return isSameCategory(transaction.category, category);
}

/**
 * Every "transactions of a month" goes through here (or filterTransactionsBySelectedMonth):
 * the month is the user's financial month (financeMonth.js), not the calendar one.
 */
export function filterTransactionsByMonth(transactions: Transaction[], year: number, month: number) {
  return filterTransactionsBySelectedMonth(transactions, `${year}-${String(month).padStart(2, '0')}`);
}

export type MonthSelection = string | Date;

export function getMonthKey(selectedMonth: MonthSelection = new Date()) {
  if (typeof selectedMonth === 'string' && isValidMonthKey(selectedMonth)) {
    return selectedMonth;
  }

  return getCurrentMonthKey(selectedMonth instanceof Date ? selectedMonth : undefined);
}

export function filterTransactionsBySelectedMonth(transactions: Transaction[], selectedMonth?: MonthSelection) {
  const monthKey = getMonthKey(selectedMonth);
  const startDay = getMonthStartDay();
  return transactions.filter((transaction) => isInFinancialMonth(transaction.date, monthKey, startDay));
}

/** The financial month (`YYYY-MM`) a transaction belongs to. */
export function transactionMonthKey(transaction: Pick<Transaction, 'date'>) {
  return financialMonthOf(transaction.date, getMonthStartDay());
}

export function filterTransactionsByScope(transactions: Transaction[], scope: FinanceScope) {
  if (scope === 'consolidado') {
    return transactions;
  }

  return transactions.filter((transaction) => transaction.scope === scope);
}

export function filterTransactionsByCategory(transactions: Transaction[], category?: string | null) {
  if (!category?.trim()) {
    return transactions;
  }

  return transactions.filter((transaction) => isCategory(transaction, category));
}

export function isInternalTransfer(transaction: Transaction) {
  return transaction.kind === 'transfer' || isCategory(transaction, internalTransferCategory);
}

export function calculateRealIncome(transactions: Transaction[]) {
  return transactions.filter(isRealIncome).reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateGrossRealExpenses(transactions: Transaction[]) {
  return transactions.filter(isRealExpense).reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateRefundAdjustments(transactions: Transaction[]) {
  return transactions.filter(isSafeExpenseRefund).reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateNetRealExpenses(transactions: Transaction[]) {
  return calculateGrossRealExpenses(transactions) - calculateRefundAdjustments(transactions);
}

export function calculateRealExpenses(transactions: Transaction[]) {
  return calculateNetRealExpenses(transactions);
}

export function calculateRealBalance(transactions: Transaction[]) {
  return calculateRealIncome(transactions) - calculateRealExpenses(transactions);
}

export function calculatePendingIncomeReview(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && isCategory(transaction, incomeReviewCategory))
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculatePendingExpenseReview(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && isCategory(transaction, expenseReviewCategory))
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateInternalTransfers(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && isInternalTransfer(transaction))
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateCardPurchases(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && transaction.kind === 'card_purchase')
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateCardPayments(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && transaction.kind === 'card_payment')
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateCardPaymentReceived(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && transaction.kind === 'card_payment_received')
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateInvestmentContributions(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && transaction.kind === 'investment_contribution')
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateInvestmentWithdrawals(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !isMatchedReimbursement(transaction) && transaction.kind === 'investment_withdrawal')
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export function calculateExpensesByCategory(transactions: Transaction[]) {
  return transactions.filter(isRealExpense).reduce<Record<string, number>>((categoryExpenses, transaction) => {
    categoryExpenses[transaction.category] = (categoryExpenses[transaction.category] ?? 0) + absoluteAmount(transaction.amount);
    return categoryExpenses;
  }, {});
}

function isNetExpenseCategoryTransaction(transaction: Transaction) {
  return isCategorySpendTransaction(transaction);
}

export function getNetExpenseCategoryTransactions(transactions: Transaction[], category: string, selectedMonth?: MonthSelection) {
  const scopedTransactions = selectedMonth ? filterTransactionsBySelectedMonth(transactions, selectedMonth) : transactions;

  return scopedTransactions
    .filter((transaction) => isCategory(transaction, category) && isNetExpenseCategoryTransaction(transaction))
    .sort((first, second) => second.date.localeCompare(first.date) || Math.abs(second.amount) - Math.abs(first.amount));
}

export function getNetExpenseSignedAmount(transaction: Transaction) {
  return netExpenseSignedAmount(transaction);
}

export type CategoryExpenseSummary = {
  category: string;
  amount: number;
  transactionsCount: number;
  spendingCount: number;
  refundCount: number;
};

export function calculateNetExpensesByCategory(transactions: Transaction[], selectedMonth?: MonthSelection) {
  const scopedTransactions = selectedMonth ? filterTransactionsBySelectedMonth(transactions, selectedMonth) : transactions;
  const categoryExpenses = new Map<string, CategoryExpenseSummary>();

  scopedTransactions.forEach((transaction) => {
    if (!isNetExpenseCategoryTransaction(transaction)) {
      return;
    }

    const current = categoryExpenses.get(transaction.category) ?? {
      category: transaction.category,
      amount: 0,
      transactionsCount: 0,
      spendingCount: 0,
      refundCount: 0,
    };
    const isRefund = isSafeExpenseRefund(transaction);

    categoryExpenses.set(transaction.category, {
      ...current,
      amount: current.amount + getNetExpenseSignedAmount(transaction),
      transactionsCount: current.transactionsCount + 1,
      spendingCount: current.spendingCount + (isRefund ? 0 : 1),
      refundCount: current.refundCount + (isRefund ? 1 : 0),
    });
  });

  return [...categoryExpenses.values()];
}

export function calculateBudgetUsedByCategory(category: string, transactions: Transaction[]) {
  return transactions
    .filter((transaction) => isCategory(transaction, category) && isNetExpenseCategoryTransaction(transaction))
    .reduce((total, transaction) => total + getNetExpenseSignedAmount(transaction), 0);
}

function budgetLimit(budget: Pick<Budget, 'limit' | 'amount'>) {
  return budget.limit ?? budget.amount ?? 0;
}

function budgetCategory(budget: Pick<Budget, 'category' | 'categories' | 'name'>) {
  return budget.category || budget.categories?.[0] || budget.name;
}

function isBudgetSpendingTransaction(transaction: Transaction) {
  return isRealExpense(transaction);
}

function isBudgetRefundTransaction(transaction: Transaction) {
  return isSafeExpenseRefund(transaction);
}

function budgetSignedAmount(transaction: Transaction) {
  return netExpenseSignedAmount(transaction);
}

export type BudgetMonthSelection = MonthSelection;

function filterBudgetMonth(transactions: Transaction[], selectedMonth?: BudgetMonthSelection) {
  if (selectedMonth) {
    return filterTransactionsBySelectedMonth(transactions, selectedMonth);
  }

  // No month given = the month of the first transaction in the list. Only for
  // callers that pass one month's list; screens and the daily context always
  // pass the month (a fresh import puts an old month first).
  const fallbackMonth = transactions[0] ? transactionMonthKey(transactions[0]) : undefined;
  return fallbackMonth ? filterTransactionsBySelectedMonth(transactions, fallbackMonth) : transactions;
}

export function getBudgetTransactions(budget: Budget, transactions: Transaction[], selectedMonth?: BudgetMonthSelection) {
  const category = budgetCategory(budget);
  const scopedTransactions = filterTransactionsByScope(filterBudgetMonth(transactions, selectedMonth), budget.scope);

  return scopedTransactions.filter(
    (transaction) =>
      isCategory(transaction, category) &&
      (isBudgetSpendingTransaction(transaction) || isBudgetRefundTransaction(transaction)),
  );
}

export function calculateBudgetUsage(budget: Budget, transactions: Transaction[], selectedMonth?: BudgetMonthSelection): BudgetUsage {
  const trackedTransactions = getBudgetTransactions(budget, transactions, selectedMonth);
  const spent = trackedTransactions.reduce((total, transaction) => total + budgetSignedAmount(transaction), 0);
  const limit = budgetLimit(budget);
  const percentUsed = limit > 0 ? (spent / limit) * 100 : 0;
  const status = percentUsed > 100 ? 'exceeded' : percentUsed > BUDGET_ATTENTION_PERCENT ? 'attention' : 'ok';

  return {
    budgetId: budget.id,
    spent,
    remaining: limit - spent,
    percentUsed,
    status,
    transactionsCount: trackedTransactions.length,
  };
}

export function calculateBudgetsSummary(budgets: Budget[], transactions: Transaction[], selectedMonth?: BudgetMonthSelection): BudgetsSummary {
  const activeBudgets = budgets.filter((budget) => budget.isActive);
  const usages = activeBudgets.map((budget) => calculateBudgetUsage(budget, transactions, selectedMonth));

  return {
    totalActive: activeBudgets.length,
    withinLimit: usages.filter((usage) => usage.status === 'ok').length,
    attention: usages.filter((usage) => usage.status === 'attention').length,
    exceeded: usages.filter((usage) => usage.status === 'exceeded').length,
    totalLimit: activeBudgets.reduce((total, budget) => total + budgetLimit(budget), 0),
    totalSpent: usages.reduce((total, usage) => total + usage.spent, 0),
    // An exceeded budget doesn't eat the room left in the others.
    totalRemaining: usages.reduce((total, usage) => total + Math.max(0, usage.remaining), 0),
  };
}

export function calculateFinanceSummary(transactions: Transaction[]): FinanceSummary {
  const calculatedTransactions = transactions.filter((transaction) => !isMatchedReimbursement(transaction));
  const income = calculateRealIncome(calculatedTransactions);
  const grossExpenses = calculateGrossRealExpenses(calculatedTransactions);
  const refundAdjustments = calculateRefundAdjustments(calculatedTransactions);
  const netExpenses = grossExpenses - refundAdjustments;
  // One rule for the month (2026-11): a card purchase is spending on the day it
  // happens, and paying the bill only moves money that was already counted.
  // The old "two pools" (cash spending − bill payments) left the card out of the
  // month until the bill was paid, so the dashboard and the budgets disagreed.

  return {
    income,
    grossExpenses,
    refundAdjustments,
    netExpenses,
    expenses: netExpenses,
    balance: income - netExpenses,
    pendingIncomeReview: calculatePendingIncomeReview(calculatedTransactions),
    pendingExpenseReview: calculatePendingExpenseReview(calculatedTransactions),
    cardPurchases: calculateCardPurchases(calculatedTransactions),
    cardPayments: calculateCardPayments(calculatedTransactions),
    cardPaymentReceived: calculateCardPaymentReceived(calculatedTransactions),
    internalTransfers: calculateInternalTransfers(calculatedTransactions),
    investmentContributions: calculateInvestmentContributions(calculatedTransactions),
    investmentWithdrawals: calculateInvestmentWithdrawals(calculatedTransactions),
    transactionCount: calculatedTransactions.length,
  };
}

export function calculateBudgetStatus(budget: Budget, transactions: Transaction[], selectedMonth?: BudgetMonthSelection): BudgetStatus {
  const usage = calculateBudgetUsage(budget, transactions, selectedMonth);
  const state = usage.status === 'exceeded' ? 'over' : usage.status === 'attention' ? 'attention' : 'inside';

  return {
    ...usage,
    percent: usage.percentUsed,
    state,
  };
}
