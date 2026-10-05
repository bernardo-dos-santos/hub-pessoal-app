import {
  type AccountType,
  type ClassificationConfidence,
  type FinanceScope,
  type TransactionKind,
  type TransactionMethod,
  type TransactionSource,
} from './finance';
import { type Transaction } from './transaction';

export type RawTransactionDraft = {
  id?: string;
  date: string;
  description: string;
  originalDescription?: string;
  amount: number | string;
  accountId?: string;
  accountName?: string;
  institution?: string;
  scope?: FinanceScope;
  accountType?: AccountType;
  method?: TransactionMethod;
  source?: TransactionSource;
  category?: string;
  categoryId?: string;
  notes?: string;
  manualCategory?: boolean;
};

export type NormalizedTransactionDraft = Transaction;

export type ImportPreviewResult = {
  totalRows: number;
  normalizedTransactions: NormalizedTransactionDraft[];
  needsReviewCount: number;
  incomeReviewTotal: number;
  expenseReviewTotal: number;
  errors: string[];
  warnings: string[];
  duplicateResults?: DuplicateCheckResult[];
  uniqueCount?: number;
  exactDuplicateCount?: number;
  possibleDuplicateCount?: number;
};

export type StructuredTransactionRow = {
  date?: string;
  description?: string;
  amount?: number | string;
  value?: number | string;
  entryAmount?: number | string;
  exitAmount?: number | string;
  details?: string;
  identifier?: string;
  category?: string;
  account?: string;
  institution?: string;
  raw?: unknown;
};

export type ParserValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type ParserProfile = {
  id: TransactionSource;
  name: string;
  source: TransactionSource;
  defaultAccountName: string;
  defaultInstitution: string;
  defaultScope: FinanceScope;
  defaultAccountType: AccountType;
  defaultMethod?: TransactionMethod;
  csvColumnAliases?: Partial<Record<keyof Omit<StructuredTransactionRow, 'raw'>, string[]>>;
  mapRowToDraft(row: StructuredTransactionRow): RawTransactionDraft;
  validateRow(row: StructuredTransactionRow): ParserValidationResult;
};

export type ParseStructuredRowsResult = {
  totalRows: number;
  drafts: RawTransactionDraft[];
  errors: string[];
  warnings: string[];
  profileId: ParserProfile['id'];
};

export type CsvRow = Record<string, string>;

export type CsvParseOptions = {
  delimiter?: string;
  expectedHeaders?: string[];
  headerRowIndex?: number;
  skipEmptyLines?: boolean;
};

export type CsvParseResult = {
  rows: CsvRow[];
  headers: string[];
  delimiter: string;
  totalRows: number;
  errors: string[];
  warnings: string[];
};

export type DuplicateStatus = 'unique' | 'exact_duplicate' | 'possible_duplicate';

export type DuplicateCheckResult = {
  transaction: NormalizedTransactionDraft;
  duplicateStatus: DuplicateStatus;
  matchedTransactionId?: string;
  reason?: string;
  confidence: ClassificationConfidence;
};

export type DeduplicatedImportPreviewResult = {
  totalRows: number;
  uniqueCount: number;
  exactDuplicateCount: number;
  possibleDuplicateCount: number;
  normalizedTransactions: NormalizedTransactionDraft[];
  duplicateResults: DuplicateCheckResult[];
  warnings: string[];
  errors: string[];
};

export type ImportSelectionItem = {
  transactionId: string;
  transaction: NormalizedTransactionDraft;
  selected: boolean;
  disabled: boolean;
  reason: string;
  duplicateStatus: DuplicateStatus;
  needsReview: boolean;
};

export type ImportBatchMetadata = {
  id: string;
  profileId?: ParserProfile['id'];
  importedAt: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
};

export type ImportCommitResult = {
  importedCount: number;
  skippedCount: number;
  exactDuplicateSkippedCount: number;
  possibleDuplicateSkippedCount: number;
  reviewCount: number;
  importedTransactions: NormalizedTransactionDraft[];
  warnings: string[];
  errors: string[];
  batchId: string;
  importedAt: string;
  batch: ImportBatchMetadata;
};
