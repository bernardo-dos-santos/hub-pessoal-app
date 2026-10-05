import { updateDailyContext } from '../../../core/context/dailyContext';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { specialCategories } from '../data/specialCategories';
import { type RawTransactionDraft } from '../types/import';
import { type Transaction } from '../types/transaction';
import { isMatchedReimbursement } from '../utils/financeCalculations';
import { inferKindFromCategory, isRefundDescription, normalizeTransactionDrafts } from './transactionNormalizationService';

const transactionsStorageKey = 'finance.transactions';

const mockTransactionDrafts: RawTransactionDraft[] = [
  {
    id: 'sample-income-1',
    date: '2026-05-05',
    description: 'Recebimento exemplo',
    originalDescription: 'Recebimento exemplo',
    amount: 3500,
    category: 'Renda',
    categoryId: 'renda',
    accountId: 'nubank-conta',
    accountName: 'Nubank Conta',
    institution: 'Nubank',
    scope: 'pessoal',
    accountType: 'checking',
    method: 'pix',
    source: 'sample',
    manualCategory: true,
  },
  {
    id: 'sample-expense-1',
    date: '2026-05-06',
    description: 'Mercado exemplo',
    originalDescription: 'Mercado exemplo',
    amount: -214.8,
    category: 'Mercado',
    categoryId: 'mercado',
    accountId: 'nubank-conta',
    accountName: 'Nubank Conta',
    institution: 'Nubank',
    scope: 'pessoal',
    accountType: 'checking',
    method: 'debito',
    source: 'sample',
    manualCategory: true,
  },
  {
    id: 'sample-card-purchase-1',
    date: '2026-05-08',
    description: 'Compra no cartão exemplo',
    originalDescription: 'Compra no cartão exemplo',
    amount: -89.9,
    category: 'Despesa a revisar',
    categoryId: 'despesa-a-revisar',
    accountId: 'nubank-cartao',
    accountName: 'Nubank Cartão',
    institution: 'Nubank',
    scope: 'pessoal',
    accountType: 'credit_card',
    method: 'credito',
    source: 'sample',
  },
  {
    id: 'sample-card-payment-1',
    date: '2026-05-10',
    description: 'Pagamento de fatura exemplo',
    originalDescription: 'Pagamento de fatura exemplo',
    amount: -500,
    category: 'Pagamento de fatura',
    categoryId: 'pagamento-de-fatura',
    accountId: 'nubank-conta',
    accountName: 'Nubank Conta',
    institution: 'Nubank',
    scope: 'pessoal',
    accountType: 'checking',
    method: 'fatura',
    source: 'sample',
  },
  {
    id: 'sample-review-income-1',
    date: '2026-05-11',
    description: 'Pix recebido a revisar',
    originalDescription: 'Pix recebido a revisar',
    amount: 120,
    category: 'Entrada a revisar',
    categoryId: 'entrada-a-revisar',
    accountId: 'nubank-conta',
    accountName: 'Nubank Conta',
    institution: 'Nubank',
    scope: 'pessoal',
    accountType: 'checking',
    method: 'pix',
    source: 'sample',
  },
];

const mockTransactions: Transaction[] = normalizeTransactionDrafts(mockTransactionDrafts);
let memoryTransactions: Transaction[] | null = null;

type CreateTransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type UpdateTransactionInput = Partial<Omit<Transaction, 'id' | 'createdAt'>>;
type ReviewTransactionInput = Partial<
  Pick<Transaction, 'category' | 'kind' | 'notes' | 'needsReview' | 'manualCategory' | 'reviewedBy' | 'installmentCount' | 'installmentValue'>
>;

const neutralKinds = new Set<Transaction['kind']>(['transfer', 'card_payment', 'card_payment_received']);
const neutralCategories = new Set<string>([
  specialCategories.internalTransfer,
  specialCategories.cardPayment,
  specialCategories.cardPaymentReceived,
]);

function isReviewCategory(transaction: Pick<Transaction, 'category'>) {
  return transaction.category === specialCategories.incomeReview || transaction.category === specialCategories.expenseReview;
}

function isRequiredReviewTransaction(transaction: Transaction) {
  if (isMatchedReimbursement(transaction)) {
    return false;
  }

  if (transaction.reviewedAt && !transaction.needsReview) {
    return false;
  }

  return (
    transaction.needsReview ||
    transaction.kind === 'review' ||
    isReviewCategory(transaction) ||
    transaction.classificationConfidence === 'low'
  );
}

function isNeutralTransaction(transaction: Transaction) {
  return neutralKinds.has(transaction.kind) || neutralCategories.has(transaction.category);
}

function isOptionalCheckTransaction(transaction: Transaction) {
  return (
    !isMatchedReimbursement(transaction) &&
    isNeutralTransaction(transaction) &&
    !transaction.reviewedAt &&
    !transaction.needsReview &&
    !isReviewCategory(transaction) &&
    transaction.kind !== 'review' &&
    transaction.classificationConfidence !== 'low'
  );
}

function readTransactions() {
  return storageAdapter.getItem<Transaction[]>(transactionsStorageKey) ?? memoryTransactions ?? [];
}

function writeTransactions(transactions: Transaction[]) {
  memoryTransactions = transactions;
  storageAdapter.setItem(transactionsStorageKey, transactions);
}

function kindClearsReview(kind: Transaction['kind']) {
  return kind === 'transfer' || kind === 'card_payment' || kind === 'card_payment_received' || kind === 'income';
}

function manualCorrectionReason(category: string, kind: Transaction['kind']) {
  return `Categoria e tipo corrigidos manualmente para ${category} / ${kind}.`;
}

function completedReviewMetadata(reviewedBy: NonNullable<Transaction['reviewedBy']>) {
  return {
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  };
}

export const transactionService = {
  listTransactions(): Transaction[] {
    return readTransactions();
  },

  listSampleTransactions(): Transaction[] {
    return [...mockTransactions];
  },

  listPendingReviewTransactions(): Transaction[] {
    return this.listRequiredReviewTransactions();
  },

  listRequiredReviewTransactions(): Transaction[] {
    return readTransactions().filter(isRequiredReviewTransaction);
  },

  listOptionalCheckTransactions(): Transaction[] {
    return readTransactions().filter(isOptionalCheckTransaction);
  },

  listNeutralTransactions(): Transaction[] {
    return readTransactions().filter(isNeutralTransaction);
  },

  listReviewableTransactions(): Transaction[] {
    const reviewableIds = new Set([
      ...this.listRequiredReviewTransactions().map((transaction) => transaction.id),
      ...this.listOptionalCheckTransactions().map((transaction) => transaction.id),
    ]);

    return readTransactions().filter((transaction) => reviewableIds.has(transaction.id));
  },

  getTransactionById(id: string): Transaction | null {
    return readTransactions().find((transaction) => transaction.id === id) ?? null;
  },

  createTransaction(input: CreateTransactionInput): Transaction {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...input,
      id: input.id ?? generateId(),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    };

    writeTransactions([transaction, ...readTransactions()]);
    const todayDate = new Date().toISOString().slice(0, 10);
    const all = readTransactions();
    const todayTxs = all.filter((t) => t.date === todayDate);
    updateDailyContext({
      finance: {
        expensesToday: todayTxs
          .filter((t) => t.kind === 'expense' || t.kind === 'card_purchase')
          .reduce((s, t) => s + Math.abs(t.amount), 0),
        incomeToday: todayTxs
          .filter((t) => t.kind === 'income')
          .reduce((s, t) => s + t.amount, 0),
        pendingReview: all.filter((t) => t.needsReview).length,
      },
    });
    return transaction;
  },

  updateTransaction(id: string, updates: UpdateTransactionInput): Transaction | null {
    let updatedTransaction: Transaction | null = null;
    const nextTransactions = readTransactions().map((transaction) => {
      if (transaction.id !== id) {
        return transaction;
      }

      updatedTransaction = {
        ...transaction,
        ...updates,
        id: transaction.id,
        createdAt: transaction.createdAt,
        updatedAt: new Date().toISOString(),
      };

      return updatedTransaction;
    });

    if (!updatedTransaction) {
      return null;
    }

    writeTransactions(nextTransactions);
    return updatedTransaction;
  },

  markTransactionReviewed(id: string): Transaction | null {
    return this.updateTransaction(id, {
      needsReview: false,
      ...completedReviewMetadata('mark_reviewed'),
    });
  },

  updateTransactionCategory(id: string, category: string): Transaction | null {
    const transaction = this.getTransactionById(id);

    if (!transaction) {
      return null;
    }

    const kind = inferKindFromCategory(category, transaction.kind, transaction.amount, transaction.description);
    const needsReview = kindClearsReview(kind) ? false : transaction.needsReview;

    return this.updateTransaction(id, {
      category,
      kind,
      manualCategory: true,
      needsReview,
      classificationReason: manualCorrectionReason(category, kind),
      ...(needsReview ? {} : completedReviewMetadata('transactions_page')),
    });
  },

  reviewTransaction(id: string, updates: ReviewTransactionInput): Transaction | null {
    const transaction = this.getTransactionById(id);

    if (!transaction) {
      return null;
    }

    const includesCategoryCorrection = Object.prototype.hasOwnProperty.call(updates, 'category');
    const includesKindCorrection = Object.prototype.hasOwnProperty.call(updates, 'kind');
    const includesManualCorrection = includesCategoryCorrection || includesKindCorrection;
    const category = updates.category ?? transaction.category;
    const requestedKind = includesKindCorrection
      ? updates.kind ?? transaction.kind
      : includesCategoryCorrection
        ? inferKindFromCategory(category, transaction.kind, transaction.amount, transaction.description)
        : transaction.kind;
    const kind =
      requestedKind === 'expense' && transaction.amount > 0 && isRefundDescription(transaction.description)
        ? inferKindFromCategory(category, requestedKind, transaction.amount, transaction.description)
        : requestedKind;
    const needsReview = updates.needsReview ?? (includesManualCorrection && kindClearsReview(kind) ? false : transaction.needsReview);

    return this.updateTransaction(id, {
      category,
      kind,
      notes: updates.notes ?? transaction.notes,
      needsReview,
      manualCategory: includesManualCorrection ? true : updates.manualCategory ?? transaction.manualCategory,
      classificationReason: includesManualCorrection
        ? manualCorrectionReason(category, kind)
        : transaction.classificationReason,
      ...(Object.prototype.hasOwnProperty.call(updates, 'installmentCount') && {
        installmentCount: updates.installmentCount,
        installmentValue: updates.installmentValue,
      }),
      ...(needsReview
        ? { reviewedAt: undefined, reviewedBy: undefined }
        : completedReviewMetadata(updates.reviewedBy ?? 'review_page')),
    });
  },

  addTransactions<T extends Transaction>(transactions: T[]): T[] {
    writeTransactions([...transactions, ...readTransactions()]);
    return transactions;
  },

  replaceTransactions(transactions: Transaction[]): Transaction[] {
    writeTransactions(transactions);
    return transactions;
  },

  seedSampleTransactions(): Transaction[] {
    return this.replaceTransactions(this.listSampleTransactions());
  },

  resetToSampleTransactions(): Transaction[] {
    return this.seedSampleTransactions();
  },

  clearTransactions(): void {
    memoryTransactions = null;
    storageAdapter.removeItem(transactionsStorageKey);
  },
};
