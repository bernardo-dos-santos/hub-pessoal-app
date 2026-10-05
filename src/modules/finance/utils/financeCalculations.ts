import { type Budget, type BudgetStatus, type BudgetsSummary, type BudgetUsage } from '../types/budget';
import { type FinanceScope, type FinanceSummary } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { specialCategories } from '../data/specialCategories';
import { getCurrentMonthKey, isValidMonthKey } from './financePeriod';
import { normalizeText } from './financeText';

export const incomeReviewCategory = specialCategories.incomeReview;
export const expenseReviewCategory = specialCategories.expenseReview;
export const internalTransferCategory = specialCategories.internalTransfer;
const neutralResultCategories = [
  specialCategories.internalTransfer,
  specialCategories.cardPayment,
  specialCategories.cardPaymentReceived,
  // Aporte/resgate movem dinheiro entre caixa e patrimônio, não consomem nada.
  specialCategories.investmentContribution,
  specialCategories.investmentWithdrawal,
];

function absoluteAmount(value: number) {
  return Math.abs(Number(value) || 0);
}

function normalizeCategory(value: string) {
  return normalizeText(value);
}

function isCategory(transaction: Pick<Transaction, 'category'>, category: string) {
  return normalizeCategory(transaction.category) === normalizeCategory(category);
}

function isNeutralResultCategory(transaction: Pick<Transaction, 'category'>) {
  return neutralResultCategories.some((category) => isCategory(transaction, category));
}

export function isMatchedReimbursement(transaction: Pick<Transaction, 'reimbursementPairId' | 'reimbursementStatus'>) {
  return Boolean(transaction.reimbursementPairId && transaction.reimbursementStatus === 'matched');
}

export function filterTransactionsByMonth(transactions: Transaction[], year: number, month: number) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  return transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey);
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
  return transactions.filter((transaction) => transaction.date.slice(0, 7) === monthKey);
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

export function isRealIncome(transaction: Transaction) {
  return (
    !isMatchedReimbursement(transaction) &&
    transaction.kind === 'income' &&
    !isCategory(transaction, incomeReviewCategory) &&
    !isNeutralResultCategory(transaction)
  );
}

export function isRealExpense(transaction: Transaction) {
  return (
    !isMatchedReimbursement(transaction) &&
    transaction.amount < 0 &&
    !isNeutralResultCategory(transaction) &&
    (transaction.kind === 'expense' || transaction.kind === 'card_purchase')
  );
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

function isCategoryReviewPending(transaction: Pick<Transaction, 'category'>) {
  return isCategory(transaction, incomeReviewCategory) || isCategory(transaction, expenseReviewCategory);
}

export function isSafeExpenseRefund(transaction: Transaction) {
  return (
    transaction.kind === 'refund' &&
    transaction.amount > 0 &&
    !isMatchedReimbursement(transaction) &&
    !isNeutralResultCategory(transaction) &&
    !isCategoryReviewPending(transaction)
  );
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

function isDashboardCategorySpend(transaction: Transaction) {
  return isRealExpense(transaction) && !isCategoryReviewPending(transaction);
}

function isNetExpenseCategoryTransaction(transaction: Transaction) {
  return isDashboardCategorySpend(transaction) || isSafeExpenseRefund(transaction);
}

export function getNetExpenseCategoryTransactions(transactions: Transaction[], category: string, selectedMonth?: MonthSelection) {
  const scopedTransactions = selectedMonth ? filterTransactionsBySelectedMonth(transactions, selectedMonth) : transactions;

  return scopedTransactions
    .filter((transaction) => isCategory(transaction, category) && isNetExpenseCategoryTransaction(transaction))
    .sort((first, second) => second.date.localeCompare(first.date) || Math.abs(second.amount) - Math.abs(first.amount));
}

export function getNetExpenseSignedAmount(transaction: Transaction) {
  return isSafeExpenseRefund(transaction) ? -absoluteAmount(transaction.amount) : absoluteAmount(transaction.amount);
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
  return isBudgetRefundTransaction(transaction) ? -absoluteAmount(transaction.amount) : absoluteAmount(transaction.amount);
}

export type BudgetMonthSelection = MonthSelection;

function filterBudgetMonth(transactions: Transaction[], selectedMonth?: BudgetMonthSelection) {
  if (selectedMonth) {
    return filterTransactionsBySelectedMonth(transactions, selectedMonth);
  }

  const fallbackMonth = transactions[0]?.date.slice(0, 7);
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
  const status = percentUsed > 100 ? 'exceeded' : percentUsed > 70 ? 'attention' : 'ok';

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
    totalRemaining: usages.reduce((total, usage) => total + usage.remaining, 0),
  };
}

export function calculateFinanceSummary(transactions: Transaction[]): FinanceSummary {
  const calculatedTransactions = transactions.filter((transaction) => !isMatchedReimbursement(transaction));
  const income = calculateRealIncome(calculatedTransactions);
  const grossExpenses = calculateGrossRealExpenses(calculatedTransactions);
  const refundAdjustments = calculateRefundAdjustments(calculatedTransactions);
  const netExpenses = grossExpenses - refundAdjustments;
  const cardPurchasesTotal = calculateCardPurchases(calculatedTransactions);
  const cardPaymentsTotal = calculateCardPayments(calculatedTransactions);
  // cash-only expenses: excludes card_purchase (credit pool), includes only expense kind
  const cashExpenses = netExpenses - cardPurchasesTotal;

  return {
    income,
    grossExpenses,
    refundAdjustments,
    netExpenses,
    expenses: netExpenses,
    cashExpenses,
    balance: income - cashExpenses - cardPaymentsTotal,
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
