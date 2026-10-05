import {
  type DeduplicatedImportPreviewResult,
  type DuplicateCheckResult,
  type NormalizedTransactionDraft,
} from '../types/import';
import { type Transaction } from '../types/transaction';
import { normalizeText } from '../utils/financeText';

type ImportTransaction = NormalizedTransactionDraft;
type ExistingTransaction = Transaction | NormalizedTransactionDraft;

function normalizeDescription(description: string) {
  return normalizeText(description).replace(/[^a-z0-9]+/g, ' ').trim();
}

function cents(amount: number) {
  return Math.round(Number(amount) * 100);
}

function normalizedSource(transaction: Pick<Transaction, 'source'>) {
  return transaction.source ?? '';
}

function normalizedInstitution(transaction: Pick<Transaction, 'institution'>) {
  return normalizeText(transaction.institution ?? '');
}

function normalizedAccount(transaction: Pick<Transaction, 'accountId' | 'accountName' | 'accountType'>) {
  return normalizeText(transaction.accountId ?? transaction.accountName ?? transaction.accountType ?? '');
}

function daysBetween(firstDate: string, secondDate: string) {
  const first = new Date(`${firstDate}T00:00:00`);
  const second = new Date(`${secondDate}T00:00:00`);

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(first.getTime() - second.getTime()) / 86_400_000;
}

function compatibleScope(first: ImportTransaction, second: ExistingTransaction) {
  return first.scope === second.scope;
}

/**
 * `source` (de onde a transação veio: e-mail sync, Pluggy, CSV manual...) não entra
 * na comparação de propósito — duas fontes diferentes cobrindo a mesma conta real
 * (ex.: sync por e-mail e Pluggy rodando em paralelo) devem continuar sendo
 * detectadas como duplicata uma da outra. Exigir a mesma fonte fazia o oposto do
 * que a deduplicação existe pra fazer.
 */
function compatibleAccount(first: ImportTransaction, second: ExistingTransaction) {
  if (first.accountType !== second.accountType) {
    return false;
  }

  if (first.institution && second.institution && normalizedInstitution(first) !== normalizedInstitution(second)) {
    return false;
  }

  const firstAccount = normalizedAccount(first);
  const secondAccount = normalizedAccount(second);

  if (firstAccount && secondAccount && firstAccount !== secondAccount) {
    return false;
  }

  return true;
}

function tokenSimilarity(firstDescription: string, secondDescription: string) {
  const firstTokens = new Set(normalizeDescription(firstDescription).split(' ').filter((token) => token.length > 2));
  const secondTokens = new Set(normalizeDescription(secondDescription).split(' ').filter((token) => token.length > 2));

  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return 0;
  }

  const intersection = [...firstTokens].filter((token) => secondTokens.has(token)).length;
  const union = new Set([...firstTokens, ...secondTokens]).size;

  return intersection / union;
}

function descriptionsMatch(firstDescription: string, secondDescription: string) {
  return normalizeDescription(firstDescription) === normalizeDescription(secondDescription);
}

function descriptionsSimilar(firstDescription: string, secondDescription: string) {
  const first = normalizeDescription(firstDescription);
  const second = normalizeDescription(secondDescription);

  return first.includes(second) || second.includes(first) || tokenSimilarity(first, second) >= 0.5;
}

export function createTransactionFingerprint(transaction: ExistingTransaction) {
  return [
    transaction.date,
    cents(transaction.amount),
    normalizeDescription(transaction.description),
    transaction.scope,
    transaction.accountType,
    normalizedSource(transaction),
    normalizedInstitution(transaction),
    normalizedAccount(transaction),
  ].join('|');
}

export function createImportFingerprint(transaction: ImportTransaction) {
  return createTransactionFingerprint(transaction);
}

export function findExactDuplicate(transaction: ImportTransaction, existingTransactions: ExistingTransaction[]) {
  return (
    existingTransactions.find(
      (existing) =>
        transaction.date === existing.date &&
        cents(transaction.amount) === cents(existing.amount) &&
        descriptionsMatch(transaction.description, existing.description) &&
        compatibleScope(transaction, existing) &&
        compatibleAccount(transaction, existing),
    ) ?? null
  );
}

export function findPossibleDuplicate(transaction: ImportTransaction, existingTransactions: ExistingTransaction[]) {
  return (
    existingTransactions.find(
      (existing) =>
        cents(transaction.amount) === cents(existing.amount) &&
        daysBetween(transaction.date, existing.date) <= 2 &&
        descriptionsSimilar(transaction.description, existing.description) &&
        compatibleScope(transaction, existing) &&
        compatibleAccount(transaction, existing),
    ) ?? null
  );
}

export function markDuplicateStatus(
  importedTransactions: ImportTransaction[],
  existingTransactions: ExistingTransaction[],
): DuplicateCheckResult[] {
  return importedTransactions.map((transaction) => {
    const exactDuplicate = findExactDuplicate(transaction, existingTransactions);

    if (exactDuplicate) {
      return {
        transaction,
        duplicateStatus: 'exact_duplicate',
        matchedTransactionId: exactDuplicate.id,
        reason: 'Mesma data, valor, descrição e conta/origem compatível.',
        confidence: 'high',
      };
    }

    const possibleDuplicate = findPossibleDuplicate(transaction, existingTransactions);

    if (possibleDuplicate) {
      return {
        transaction,
        duplicateStatus: 'possible_duplicate',
        matchedTransactionId: possibleDuplicate.id,
        reason: 'Data próxima, mesmo valor, descrição parecida e conta/origem compatível.',
        confidence: 'medium',
      };
    }

    return {
      transaction,
      duplicateStatus: 'unique',
      reason: 'Nenhuma duplicata compatível encontrada.',
      confidence: 'low',
    };
  });
}

export function deduplicateImportPreview(
  importedTransactions: ImportTransaction[],
  existingTransactions: ExistingTransaction[],
): DeduplicatedImportPreviewResult {
  const duplicateResults = markDuplicateStatus(importedTransactions, existingTransactions);
  const exactDuplicateCount = duplicateResults.filter((result) => result.duplicateStatus === 'exact_duplicate').length;
  const possibleDuplicateCount = duplicateResults.filter((result) => result.duplicateStatus === 'possible_duplicate').length;
  const uniqueCount = duplicateResults.filter((result) => result.duplicateStatus === 'unique').length;

  return {
    totalRows: importedTransactions.length,
    uniqueCount,
    exactDuplicateCount,
    possibleDuplicateCount,
    normalizedTransactions: importedTransactions,
    duplicateResults,
    warnings: duplicateResults
      .filter((result) => result.duplicateStatus !== 'unique')
      .map((result) => `${result.duplicateStatus}: ${result.transaction.description} (${result.reason})`),
    errors: [],
  };
}
