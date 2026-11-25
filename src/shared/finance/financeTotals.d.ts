/** Minimal shape the totals rule reads — app `Transaction`s and raw server rows both fit. */
export type FinanceTxLike = {
  amount: number;
  kind?: string;
  category?: string;
  scope?: string;
  reimbursementPairId?: string | null;
  reimbursementStatus?: string | null;
  needsReview?: boolean;
  reviewedAt?: string | null;
  classificationConfidence?: string;
};

export type FinanceBudgetLike = {
  limit?: number;
  amount?: number;
  category?: string;
  categories?: string[];
  name?: string;
  scope?: string;
};

export declare const SPECIAL_CATEGORIES: {
  readonly incomeReview: 'Entrada a revisar';
  readonly expenseReview: 'Despesa a revisar';
  readonly internalTransfer: 'Transferência interna';
  readonly cardPayment: 'Pagamento de fatura';
  readonly cardPaymentReceived: 'Pagamento recebido da fatura';
  readonly investmentContribution: 'Aporte em investimento';
  readonly investmentWithdrawal: 'Resgate de investimento';
};

export declare function normalizeFinanceText(text: unknown): string;
export declare function isSameCategory(a: unknown, b: unknown): boolean;
export declare function isMatchedReimbursement(t: Pick<FinanceTxLike, 'reimbursementPairId' | 'reimbursementStatus'>): boolean;
export declare function isNeutralCategory(t: Pick<FinanceTxLike, 'category'>): boolean;
export declare function isNeutralTransaction(t: Pick<FinanceTxLike, 'category' | 'kind'>): boolean;
export declare function isReviewPlaceholderCategory(t: Pick<FinanceTxLike, 'category'>): boolean;
export declare function isRealIncome(t: FinanceTxLike): boolean;
export declare function isRealExpense(t: FinanceTxLike): boolean;
export declare function isSafeExpenseRefund(t: FinanceTxLike): boolean;
export declare function isCategorySpendTransaction(t: FinanceTxLike): boolean;
export declare function netExpenseSignedAmount(t: FinanceTxLike): number;
export declare function summarizeTotals(transactions: FinanceTxLike[]): {
  income: number;
  grossExpenses: number;
  refundAdjustments: number;
  expenses: number;
  balance: number;
  cardPurchases: number;
  pendingExpenseReview: number;
};
export declare function netExpensesByCategory(transactions: FinanceTxLike[]): { category: string; amount: number }[];
export declare function budgetLimitOf(budget: FinanceBudgetLike): number;
export declare function budgetCategoryOf(budget: FinanceBudgetLike): string | undefined;
export declare function budgetSpent(budget: FinanceBudgetLike, monthTransactions: FinanceTxLike[]): number;
export declare function isRequiredReviewTransaction(t: FinanceTxLike): boolean;
