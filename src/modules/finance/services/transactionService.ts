import { updateDailyContext } from '../../../core/context/dailyContext';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { specialCategories } from '../data/specialCategories';
import { type Transaction } from '../types/transaction';
import { isMatchedReimbursement, transactionMonthKey } from '../utils/financeCalculations';
import { getCurrentMonthKey } from '../utils/financePeriod';
import { inferKindFromCategory, isRefundDescription } from './transactionNormalizationService';
import { localDayKey } from '../../../shared/dates/localDay';
import {
  isRealExpense,
  isRealIncome,
  isRequiredReviewTransaction,
  isReviewPlaceholderCategory,
  isSafeExpenseRefund,
} from '../../../shared/finance/financeTotals.js';

const transactionsStorageKey = 'finance.transactions';
/** Imported lines the person deleted, as the bank sent them: a re-import must not bring them back. */
const deletedImportsStorageKey = 'finance.transactions.deletedImports';
const DELETED_IMPORTS_KEPT = 1000;

export type TransactionEdit = Partial<Pick<Transaction, 'description' | 'amount' | 'date' | 'method' | 'category' | 'kind' | 'notes' | 'needsReview'>>;
export type SplitPart = { amount: number; category: string };

function isImportedSource(transaction: Transaction) {
  return transaction.source !== 'manual' && transaction.source !== 'sample';
}

function asImported(transaction: Transaction): Transaction {
  return transaction.importedAs ? { ...transaction, ...transaction.importedAs } : transaction;
}

function readDeletedImports() {
  return storageAdapter.getItem<Transaction[]>(deletedImportsStorageKey) ?? [];
}

function writeDeletedImports(list: Transaction[]) {
  storageAdapter.setItem(deletedImportsStorageKey, list.slice(-DELETED_IMPORTS_KEPT));
}

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

function isNeutralTransaction(transaction: Transaction) {
  return neutralKinds.has(transaction.kind) || neutralCategories.has(transaction.category);
}

function isOptionalCheckTransaction(transaction: Transaction) {
  return (
    !isMatchedReimbursement(transaction) &&
    isNeutralTransaction(transaction) &&
    !transaction.reviewedAt &&
    !transaction.needsReview &&
    !isReviewPlaceholderCategory(transaction) &&
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

  listPendingReviewTransactions(): Transaction[] {
    return this.listRequiredReviewTransactions();
  },

  listRequiredReviewTransactions(): Transaction[] {
    return readTransactions().filter(isRequiredReviewTransaction);
  },

  /**
   * What is left to review in the current financial month — the number the
   * Revisar badge and the alert show. Past months' pending items stay reachable
   * by picking the month in Revisar, but no longer nag (Bernardo, 2026-11-22).
   */
  listCurrentMonthReviewTransactions(): Transaction[] {
    const month = getCurrentMonthKey();
    return readTransactions().filter((t) => isRequiredReviewTransaction(t) && transactionMonthKey(t) === month);
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
    const todayDate = localDayKey();
    const all = readTransactions();
    const todayTxs = all.filter((t) => t.date === todayDate);
    updateDailyContext({
      finance: {
        expensesToday:
          todayTxs.filter(isRealExpense).reduce((s, t) => s + Math.abs(t.amount), 0) -
          todayTxs.filter(isSafeExpenseRefund).reduce((s, t) => s + Math.abs(t.amount), 0),
        incomeToday: todayTxs.filter(isRealIncome).reduce((s, t) => s + t.amount, 0),
        pendingReview: all.filter((t) => isRequiredReviewTransaction(t) && transactionMonthKey(t) === getCurrentMonthKey()).length,
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

  /**
   * A correction made by the person (Gastos). Changing date, amount or
   * description of an imported line first records how the bank sent it.
   */
  editTransaction(id: string, changes: TransactionEdit): Transaction | null {
    const transaction = this.getTransactionById(id);
    if (!transaction) return null;
    const touchesIdentity =
      (changes.date !== undefined && changes.date !== transaction.date) ||
      (changes.amount !== undefined && changes.amount !== transaction.amount) ||
      (changes.description !== undefined && changes.description !== transaction.description);
    const categoryChanged = changes.category !== undefined && changes.category !== transaction.category;
    const kindChanged = changes.kind !== undefined && changes.kind !== transaction.kind;
    const category = changes.category ?? transaction.category;
    const kind = changes.kind ?? transaction.kind;
    const needsReview = changes.needsReview ?? transaction.needsReview;
    return this.updateTransaction(id, {
      ...changes,
      ...(touchesIdentity && isImportedSource(transaction) && !transaction.importedAs
        ? { importedAs: { date: transaction.date, amount: transaction.amount, description: transaction.description } }
        : {}),
      ...(categoryChanged || kindChanged
        ? { manualCategory: true, classificationReason: manualCorrectionReason(category, kind) }
        : {}),
      ...(needsReview ? { reviewedAt: undefined, reviewedBy: undefined } : transaction.needsReview ? completedReviewMetadata('transactions_page') : {}),
    });
  },

  /** Removes it; the caller can put it back with `restoreTransaction`. */
  deleteTransaction(id: string): Transaction | null {
    const all = readTransactions();
    const transaction = all.find((item) => item.id === id);
    if (!transaction) return null;
    writeTransactions(
      all
        .filter((item) => item.id !== id)
        // A partner left pointing at nothing would stay "pareado" forever.
        .map((item) => {
          if (transaction.reimbursementPairId && item.reimbursementPairId === transaction.reimbursementPairId) {
            return { ...item, reimbursementPairId: undefined, reimbursementRole: undefined, reimbursementStatus: undefined, reimbursementMatchedAt: undefined };
          }
          if (item.linkedTransferId === transaction.id) return { ...item, linkedTransferId: undefined };
          return item;
        }),
    );
    if (isImportedSource(transaction) && !transaction.splitFromId) {
      writeDeletedImports([...readDeletedImports(), asImported(transaction)]);
    }
    return transaction;
  },

  restoreTransaction(transaction: Transaction): void {
    writeTransactions([transaction, ...readTransactions().filter((item) => item.id !== transaction.id)]);
    const deleted = readDeletedImports();
    if (deleted.some((item) => item.id === transaction.id)) writeDeletedImports(deleted.filter((item) => item.id !== transaction.id));
  },

  /**
   * One line, several categories (the market run that was half pharmacy).
   * The original keeps the first part; the others are new lines on the same
   * date and account. Amounts are positive; the sign follows the original.
   */
  splitTransaction(id: string, parts: SplitPart[]): Transaction[] {
    const transaction = this.getTransactionById(id);
    if (!transaction) throw new Error('Lançamento não encontrado.');
    if (parts.length < 2) throw new Error('Divida em pelo menos duas partes.');
    if (parts.some((part) => !(part.amount > 0) || !part.category.trim())) throw new Error('Cada parte precisa de valor e categoria.');
    const totalCents = Math.round(Math.abs(transaction.amount) * 100);
    const partsCents = parts.reduce((sum, part) => sum + Math.round(part.amount * 100), 0);
    if (partsCents !== totalCents) throw new Error('As partes precisam somar o valor do lançamento.');

    const sign = transaction.amount < 0 ? -1 : 1;
    const [first, ...rest] = parts;
    const now = new Date().toISOString();
    const kindFor = (category: string) => inferKindFromCategory(category, transaction.kind, transaction.amount, transaction.description);
    const original = this.editTransaction(id, {
      amount: sign * first.amount,
      category: first.category,
      kind: kindFor(first.category),
      needsReview: false,
    });
    const created: Transaction[] = rest.map((part) => ({
      ...transaction,
      id: generateId('finance-transaction'),
      amount: sign * part.amount,
      category: part.category,
      kind: kindFor(part.category),
      manualCategory: true,
      needsReview: false,
      classificationReason: manualCorrectionReason(part.category, kindFor(part.category)),
      splitFromId: transaction.id,
      importedAs: undefined,
      reimbursementPairId: undefined,
      reimbursementRole: undefined,
      reimbursementStatus: undefined,
      reimbursementMatchedAt: undefined,
      linkedTransferId: undefined,
      ...completedReviewMetadata('transactions_page'),
      createdAt: now,
      updatedAt: now,
    }));
    writeTransactions([...created, ...readTransactions()]);
    return original ? [original, ...created] : created;
  },

  /**
   * What an import compares against: every line as the bank sent it, plus the
   * imported lines the person deleted. Split parts never came from a statement.
   */
  listForDuplicateCheck(): Transaction[] {
    return [...readTransactions().filter((item) => !item.splitFromId).map(asImported), ...readDeletedImports()];
  },

  isDeletedImport(id: string): boolean {
    return readDeletedImports().some((item) => item.id === id);
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


};
