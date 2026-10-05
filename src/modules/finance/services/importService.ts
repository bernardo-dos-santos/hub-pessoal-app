import { specialCategories } from '../data/specialCategories';
import {
  type CsvParseOptions,
  type ImportPreviewResult,
  type ParserProfile,
  type RawTransactionDraft,
  type StructuredTransactionRow,
} from '../types/import';
import { type Transaction } from '../types/transaction';
import { parseCsvToStructuredRows } from './parsers/csvStructuredMapper';
import { parseStructuredRows } from './parsers/structuredTransactionParser';
import { deduplicateImportPreview } from './transactionDeduplicationService';
import { normalizeTransactionDrafts } from './transactionNormalizationService';

function absoluteAmount(value: number) {
  return Math.abs(Number(value) || 0);
}

function withDeduplication<T extends ImportPreviewResult>(
  preview: T,
  existingTransactions?: Transaction[],
): T {
  if (!existingTransactions) {
    return preview;
  }

  const deduplicated = deduplicateImportPreview(preview.normalizedTransactions, existingTransactions);

  return {
    ...preview,
    duplicateResults: deduplicated.duplicateResults,
    uniqueCount: deduplicated.uniqueCount,
    exactDuplicateCount: deduplicated.exactDuplicateCount,
    possibleDuplicateCount: deduplicated.possibleDuplicateCount,
    warnings: [...preview.warnings, ...deduplicated.warnings],
    errors: [...preview.errors, ...deduplicated.errors],
  };
}

export const importService = {
  receiveRawTransactionDrafts(inputs: RawTransactionDraft[]) {
    return inputs;
  },

  normalizeImportDrafts(inputs: RawTransactionDraft[]) {
    return normalizeTransactionDrafts(inputs);
  },

  previewImportDrafts(inputs: RawTransactionDraft[], existingTransactions?: Transaction[]): ImportPreviewResult {
    const normalizedTransactions = this.normalizeImportDrafts(inputs);

    return withDeduplication({
      totalRows: inputs.length,
      normalizedTransactions,
      needsReviewCount: normalizedTransactions.filter((transaction) => transaction.needsReview).length,
      incomeReviewTotal: normalizedTransactions
        .filter((transaction) => transaction.category === specialCategories.incomeReview)
        .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0),
      expenseReviewTotal: normalizedTransactions
        .filter((transaction) => transaction.category === specialCategories.expenseReview)
        .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0),
      errors: [],
      warnings: normalizedTransactions
        .filter((transaction) => transaction.needsReview)
        .map((transaction) => `Revisar "${transaction.description}": ${transaction.classificationReason}`),
    }, existingTransactions);
  },

  normalizeStructuredImport(rows: StructuredTransactionRow[], profile: ParserProfile) {
    const parsed = parseStructuredRows(rows, profile);

    return normalizeTransactionDrafts(parsed.drafts);
  },

  previewStructuredImport(rows: StructuredTransactionRow[], profile: ParserProfile, existingTransactions?: Transaction[]): ImportPreviewResult {
    const parsed = parseStructuredRows(rows, profile);
    const normalizedTransactions = normalizeTransactionDrafts(parsed.drafts);
    const reviewWarnings = normalizedTransactions
      .filter((transaction) => transaction.needsReview)
      .map((transaction) => `Revisar "${transaction.description}": ${transaction.classificationReason}`);

    return withDeduplication({
      totalRows: parsed.totalRows,
      normalizedTransactions,
      needsReviewCount: normalizedTransactions.filter((transaction) => transaction.needsReview).length,
      incomeReviewTotal: normalizedTransactions
        .filter((transaction) => transaction.category === specialCategories.incomeReview)
        .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0),
      expenseReviewTotal: normalizedTransactions
        .filter((transaction) => transaction.category === specialCategories.expenseReview)
        .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0),
      errors: parsed.errors,
      warnings: [...parsed.warnings, ...reviewWarnings],
    }, existingTransactions);
  },

  normalizeCsvImport(text: string, profile: ParserProfile, options: CsvParseOptions = {}) {
    const parsedCsv = parseCsvToStructuredRows(text, profile, options);

    return this.normalizeStructuredImport(parsedCsv.structuredRows, profile);
  },

  previewCsvImport(
    text: string,
    profile: ParserProfile,
    options: CsvParseOptions = {},
    existingTransactions?: Transaction[],
  ): ImportPreviewResult {
    const parsedCsv = parseCsvToStructuredRows(text, profile, options);
    const preview = this.previewStructuredImport(parsedCsv.structuredRows, profile, existingTransactions);

    return {
      ...preview,
      totalRows: parsedCsv.totalRows,
      errors: [...parsedCsv.errors, ...preview.errors],
      warnings: [...parsedCsv.warnings, ...preview.warnings],
    };
  },
};
