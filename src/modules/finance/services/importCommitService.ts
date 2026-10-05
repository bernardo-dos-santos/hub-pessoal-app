import { generateId } from '../../../shared/utils/generateId';
import {
  type DuplicateCheckResult,
  type DuplicateStatus,
  type ImportBatchMetadata,
  type ImportCommitResult,
  type ImportPreviewResult,
  type ImportSelectionItem,
  type NormalizedTransactionDraft,
  type ParserProfile,
} from '../types/import';
import { type Transaction } from '../types/transaction';
import { reimbursementService } from './reimbursementService';
import { findExactDuplicate } from './transactionDeduplicationService';
import { transactionService } from './transactionService';

type ImportBatchMetadataInput = {
  profileId?: ParserProfile['id'];
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  importedAt?: string;
};

type PreparedImportCommit = {
  previewResult: ImportPreviewResult;
  selection: ImportSelectionItem[];
};

function duplicateResultById(previewResult: ImportPreviewResult, transactionId: string): DuplicateCheckResult | undefined {
  return previewResult.duplicateResults?.find((result) => result.transaction.id === transactionId);
}

function duplicateStatusFor(previewResult: ImportPreviewResult, transactionId: string): DuplicateStatus {
  return duplicateResultById(previewResult, transactionId)?.duplicateStatus ?? 'unique';
}

function getSelectionReason(status: DuplicateStatus, duplicateResult?: DuplicateCheckResult) {
  if (status === 'exact_duplicate') {
    return duplicateResult?.reason ?? 'Duplicata exata bloqueada no commit.';
  }

  if (status === 'possible_duplicate') {
    return duplicateResult?.reason ?? 'Possivel duplicata precisa de escolha explicita.';
  }

  return 'Transacao unica pronta para salvar.';
}

export function getDefaultSelectedImportItems(previewResult: ImportPreviewResult): ImportSelectionItem[] {
  return previewResult.normalizedTransactions.map((transaction) => {
    const duplicateResult = duplicateResultById(previewResult, transaction.id);
    const duplicateStatus = duplicateStatusFor(previewResult, transaction.id);

    return {
      transactionId: transaction.id,
      transaction,
      selected: duplicateStatus === 'unique',
      disabled: duplicateStatus === 'exact_duplicate',
      reason: getSelectionReason(duplicateStatus, duplicateResult),
      duplicateStatus,
      needsReview: transaction.needsReview,
    };
  });
}

export function prepareImportCommit(previewResult: ImportPreviewResult): PreparedImportCommit {
  return {
    previewResult,
    selection: getDefaultSelectedImportItems(previewResult),
  };
}

export function createImportBatchMetadata(input: ImportBatchMetadataInput): ImportBatchMetadata {
  return {
    id: generateId('finance-import-batch'),
    profileId: input.profileId,
    importedAt: input.importedAt ?? new Date().toISOString(),
    totalRows: input.totalRows,
    importedCount: input.importedCount,
    skippedCount: input.skippedCount,
  };
}

function isExactDuplicateAtCommit(transaction: NormalizedTransactionDraft, existingTransactions: Transaction[]) {
  return Boolean(findExactDuplicate(transaction, existingTransactions));
}

export function commitImportSelection(
  selection: ImportSelectionItem[],
  existingTransactions: Transaction[],
  profileId?: ParserProfile['id'],
): ImportCommitResult {
  const importedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];
  const importedTransactions: NormalizedTransactionDraft[] = [];
  let exactDuplicateSkippedCount = 0;
  let possibleDuplicateSkippedCount = 0;

  for (const item of selection) {
    if (item.disabled || item.duplicateStatus === 'exact_duplicate') {
      exactDuplicateSkippedCount += 1;
      continue;
    }

    if (!item.selected) {
      if (item.duplicateStatus === 'possible_duplicate') {
        possibleDuplicateSkippedCount += 1;
      }

      continue;
    }

    if (isExactDuplicateAtCommit(item.transaction, [...existingTransactions, ...importedTransactions])) {
      exactDuplicateSkippedCount += 1;
      warnings.push(`Duplicata exata ignorada no commit: ${item.transaction.description}.`);
      continue;
    }

    importedTransactions.push(item.transaction);
  }

  transactionService.addTransactions(importedTransactions);
  reimbursementService.applyReimbursementPairs();

  const skippedCount = selection.length - importedTransactions.length;
  const batch = createImportBatchMetadata({
    profileId,
    totalRows: selection.length,
    importedCount: importedTransactions.length,
    skippedCount,
    importedAt,
  });

  return {
    importedCount: importedTransactions.length,
    skippedCount,
    exactDuplicateSkippedCount,
    possibleDuplicateSkippedCount,
    reviewCount: importedTransactions.filter((transaction) => transaction.needsReview).length,
    importedTransactions,
    warnings,
    errors,
    batchId: batch.id,
    importedAt: batch.importedAt,
    batch,
  };
}

export const importCommitService = {
  prepareImportCommit,
  getDefaultSelectedImportItems,
  commitImportSelection,
  createImportBatchMetadata,
};
