export type FinanceScope = 'pessoal' | 'empresa' | 'consolidado';

export type AccountType = 'checking' | 'credit_card' | 'cash' | 'business_checking';

export type TransactionMethod =
  | 'pix'
  | 'debito'
  | 'credito'
  | 'boleto'
  | 'fatura'
  | 'transferencia'
  | 'dinheiro'
  | 'outro';

export type TransactionKind =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'card_purchase'
  | 'card_payment'
  | 'card_payment_received'
  | 'refund'
  | 'review'
  /**
   * Dinheiro indo pra investimento ou voltando dele. Neutro no resultado, pelo
   * mesmo motivo de `transfer`: o dinheiro mudou de lugar, não foi consumido —
   * tratar aporte como despesa inflava o gasto do mês e quebrava a projeção.
   */
  | 'investment_contribution'
  | 'investment_withdrawal';

export type TransactionSource = 'manual' | 'nubank_account' | 'nubank_credit_card' | 'c6_business' | 'pluggy' | 'sample' | 'imported';

export type ClassificationConfidence = 'high' | 'medium' | 'low';

export type FinanceSummary = {
  income: number;
  grossExpenses: number;
  refundAdjustments: number;
  netExpenses: number;
  /** "Gastei": everything consumed in the month — card purchases on their own date, minus refunds. */
  expenses: number;
  /** "Sobrou": income − expenses. Paying the card bill, transfers and investments are neutral. */
  balance: number;
  pendingIncomeReview: number;
  pendingExpenseReview: number;
  cardPurchases: number;
  cardPayments: number;
  cardPaymentReceived: number;
  internalTransfers: number;
  /** Fora do resultado, igual a transferência — exposto pra ficar visível. */
  investmentContributions: number;
  investmentWithdrawals: number;
  transactionCount: number;
};

export type MonthlyFinanceSummary = FinanceSummary & {
  month: string;
  requiredReviewCount: number;
  optionalCheckCount: number;
};

export type MonthlyComparisonDelta = {
  currentValue: number;
  previousValue: number;
  difference: number;
  percentChange: number | null;
};

export type MonthlyFinanceComparison = {
  currentMonth: string;
  previousMonth: string;
  /** Set while the month is under way: the previous one is cut at the same point (`YYYY-MM-DD`). */
  previousUntil?: string;
  currentSummary: MonthlyFinanceSummary;
  previousSummary: MonthlyFinanceSummary;
  deltas: {
    income: MonthlyComparisonDelta;
    expenses: MonthlyComparisonDelta;
    balance: Omit<MonthlyComparisonDelta, 'percentChange'>;
    cardPurchases: MonthlyComparisonDelta;
    transactionCount: Omit<MonthlyComparisonDelta, 'percentChange'>;
  };
};

export type MonthlyEvolutionPoint = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
};

export type MonthlyCategoryComparison = {
  category: string;
  currentAmount: number;
  previousAmount: number;
  difference: number;
  percentChange: number | null;
  currentTransactionCount: number;
  previousTransactionCount: number;
};

export type MonthlyCategoryComparisonTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  kind: TransactionKind;
  account?: string;
  source?: TransactionSource;
  isRefund: boolean;
  isCardPurchase: boolean;
  isExpense: boolean;
};

export type MonthlyCategoryComparisonDetails = MonthlyCategoryComparison & {
  currentMonth: string;
  previousMonth: string;
  currentLabel: string;
  previousLabel: string;
  currentTransactions: MonthlyCategoryComparisonTransaction[];
  previousTransactions: MonthlyCategoryComparisonTransaction[];
};
