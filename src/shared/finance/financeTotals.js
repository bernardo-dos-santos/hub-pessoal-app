/**
 * What counts as income, spending and "to review" — the one rule the app, the
 * Íris, the briefing, the push and the monthly summary all read (plain JS + a
 * .d.ts, like financeMonth.js). Before 2026-11-22 the server kept its own copy:
 * it summed every expense without taking refunds off, counted matched
 * reimbursements, and a 200 purchase refunded in full was "gastei 0" on the
 * dashboard and "gastei 200" to the Íris.
 *
 * - Gastei = real expenses (expense / card purchase, negative, not neutral)
 *   minus refunds that aren't paired to anything.
 * - Recebi = income that is positive, not a review placeholder, not neutral.
 * - Neutral (money changing place): internal transfers, paying the card bill,
 *   the bill payment received on the card, investment contribution/withdrawal.
 * - A matched reimbursement pair cancels out and is left out entirely.
 */

export const SPECIAL_CATEGORIES = {
  incomeReview: 'Entrada a revisar',
  expenseReview: 'Despesa a revisar',
  internalTransfer: 'Transferência interna',
  cardPayment: 'Pagamento de fatura',
  cardPaymentReceived: 'Pagamento recebido da fatura',
  investmentContribution: 'Aporte em investimento',
  investmentWithdrawal: 'Resgate de investimento',
};

/** Accent-, case- and space-insensitive form of a category or description. */
export function normalizeFinanceText(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameCategory(a, b) {
  return normalizeFinanceText(a) === normalizeFinanceText(b);
}

const NEUTRAL_CATEGORIES = [
  SPECIAL_CATEGORIES.internalTransfer,
  SPECIAL_CATEGORIES.cardPayment,
  SPECIAL_CATEGORIES.cardPaymentReceived,
  SPECIAL_CATEGORIES.investmentContribution,
  SPECIAL_CATEGORIES.investmentWithdrawal,
].map(normalizeFinanceText);

const NEUTRAL_KINDS = new Set([
  'transfer',
  'card_payment',
  'card_payment_received',
  'investment_contribution',
  'investment_withdrawal',
]);

const abs = (value) => Math.abs(Number(value) || 0);

export function isMatchedReimbursement(t) {
  return Boolean(t.reimbursementPairId && t.reimbursementStatus === 'matched');
}

export function isNeutralCategory(t) {
  return NEUTRAL_CATEGORIES.includes(normalizeFinanceText(t.category));
}

/** Money changing place: never income, never spending. */
export function isNeutralTransaction(t) {
  return NEUTRAL_KINDS.has(t.kind) || isNeutralCategory(t);
}

export function isReviewPlaceholderCategory(t) {
  return isSameCategory(t.category, SPECIAL_CATEGORIES.incomeReview) || isSameCategory(t.category, SPECIAL_CATEGORIES.expenseReview);
}

export function isRealIncome(t) {
  return (
    !isMatchedReimbursement(t) &&
    t.kind === 'income' &&
    Number(t.amount) > 0 &&
    !isSameCategory(t.category, SPECIAL_CATEGORIES.incomeReview) &&
    !isNeutralCategory(t)
  );
}

export function isRealExpense(t) {
  return (
    !isMatchedReimbursement(t) &&
    Number(t.amount) < 0 &&
    !isNeutralCategory(t) &&
    (t.kind === 'expense' || t.kind === 'card_purchase')
  );
}

/** A refund that takes spending off: positive, not paired, not neutral, already categorized. */
export function isSafeExpenseRefund(t) {
  return (
    t.kind === 'refund' &&
    Number(t.amount) > 0 &&
    !isMatchedReimbursement(t) &&
    !isNeutralCategory(t) &&
    !isReviewPlaceholderCategory(t)
  );
}

/** Spending and refunds that belong to a category ("Onde foi", budgets). */
export function isCategorySpendTransaction(t) {
  return (isRealExpense(t) && !isReviewPlaceholderCategory(t)) || isSafeExpenseRefund(t);
}

/** Positive for spending, negative for a refund. */
export function netExpenseSignedAmount(t) {
  return isSafeExpenseRefund(t) ? -abs(t.amount) : abs(t.amount);
}

/** Recebi / Gastei / Sobrou for an already month-filtered list. */
export function summarizeTotals(transactions) {
  let income = 0;
  let grossExpenses = 0;
  let refundAdjustments = 0;
  let cardPurchases = 0;
  let pendingExpenseReview = 0;

  for (const t of transactions) {
    if (isMatchedReimbursement(t)) continue;
    if (isRealIncome(t)) income += abs(t.amount);
    if (isRealExpense(t)) {
      grossExpenses += abs(t.amount);
      if (t.kind === 'card_purchase') cardPurchases += abs(t.amount);
      if (isSameCategory(t.category, SPECIAL_CATEGORIES.expenseReview)) pendingExpenseReview += abs(t.amount);
    }
    if (isSafeExpenseRefund(t)) refundAdjustments += abs(t.amount);
  }

  const expenses = grossExpenses - refundAdjustments;
  return { income, grossExpenses, refundAdjustments, expenses, balance: income - expenses, cardPurchases, pendingExpenseReview };
}

/** Net spending per category, largest first. */
export function netExpensesByCategory(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    if (!isCategorySpendTransaction(t)) continue;
    const key = t.category || 'Outros';
    totals.set(key, (totals.get(key) ?? 0) + netExpenseSignedAmount(t));
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function budgetLimitOf(budget) {
  return Number(budget.limit ?? budget.amount ?? 0) || 0;
}

export function budgetCategoryOf(budget) {
  return budget.category || budget.categories?.[0] || budget.name;
}

/** Net spending of a budget's category (and scope) in an already month-filtered list. */
export function budgetSpent(budget, monthTransactions) {
  const category = budgetCategoryOf(budget);
  const scope = budget.scope;
  return monthTransactions
    .filter((t) => (!scope || scope === 'consolidado' || t.scope === scope))
    .filter((t) => isSameCategory(t.category, category) && isCategorySpendTransaction(t))
    .reduce((sum, t) => sum + netExpenseSignedAmount(t), 0);
}

/** Needs the person's answer (the Revisar queue, its badge and the Íris's count). */
export function isRequiredReviewTransaction(t) {
  if (isMatchedReimbursement(t)) return false;
  if (t.reviewedAt && !t.needsReview) return false;
  return Boolean(
    t.needsReview ||
    t.kind === 'review' ||
    isReviewPlaceholderCategory(t) ||
    t.classificationConfidence === 'low',
  );
}
