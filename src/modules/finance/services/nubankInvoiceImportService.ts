import { apiUrl } from '../../../core/config/backendConfig';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { type RawTransactionDraft } from '../types/import';
import { commitImportSelection, getDefaultSelectedImportItems } from './importCommitService';
import { nubankCreditCardProfile } from './parsers/parserProfiles';
import { importService } from './importService';
import { transactionService } from './transactionService';
import { isRequiredReviewTransaction } from '../../../shared/finance/financeTotals.js';
import { transactionMonthKey } from '../utils/financeCalculations';

const IMPORTED_SOURCES_KEY = 'finance.nubankInvoiceImportedSources';

type InvoiceTransaction = {
  date: string;
  description: string;
  /** Positive for a purchase; a refund may come either way — only isRefund decides. */
  amount: number;
  isRefund: boolean;
  installment: { current: number; total: number } | null;
  source: string;
};

type InvoicePending = {
  exportedAt: string;
  sourceFile: string;
  invoiceYear: string;
  transactions: InvoiceTransaction[];
};

export type InvoiceImportResult =
  | { imported: number; skipped: number; sourceFile: string; reviewCount: number; reviewMonths: string[]; error?: undefined }
  | { error: string; imported?: undefined }
  | null;

function getImportedSources(): string[] {
  return storageAdapter.getItem<string[]>(IMPORTED_SOURCES_KEY) ?? [];
}

function markSourceImported(sourceFile: string): void {
  const sources = getImportedSources();
  if (!sources.includes(sourceFile)) {
    storageAdapter.setItem(IMPORTED_SOURCES_KEY, [...sources, sourceFile]);
  }
}

function buildDescription(tx: InvoiceTransaction): string {
  if (tx.installment) {
    return `${tx.description} (${tx.installment.current}/${tx.installment.total})`;
  }
  return tx.description;
}

/** One PDF line as the same draft a card CSV line becomes. */
function toDraft(tx: InvoiceTransaction): RawTransactionDraft {
  const value = Math.abs(Number(tx.amount) || 0);
  return {
    date: tx.date,
    description: buildDescription(tx),
    originalDescription: tx.description,
    // A purchase leaves the card (negative); a refund comes back (positive). The
    // parser sends refunds already negative, and flipping that again made every
    // refund add to the bill instead of taking off it.
    amount: tx.isRefund ? value : -value,
    accountName: nubankCreditCardProfile.defaultAccountName,
    institution: nubankCreditCardProfile.defaultInstitution,
    scope: 'pessoal',
    accountType: 'credit_card',
    method: 'credito',
    source: 'nubank_credit_card',
  };
}

/**
 * Imports the PDF bill the sync left on the server, through the same path as a
 * card CSV: classifier and aliases, duplicate check against saved transactions
 * (date + value + description + account — it used to be date + value only, so a
 * R$ 25 lunch vanished when a R$ 25 Pix happened the same day), reimbursement
 * pairing. Errors come back as `{ error }` instead of looking like "nothing new".
 */
export async function checkAndAutoImportInvoice(): Promise<InvoiceImportResult> {
  let data: InvoicePending;
  try {
    const res = await fetch(apiUrl('/api/pending/nubank-invoice'), { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) return { error: `O servidor respondeu ${res.status} ao buscar a fatura.` };
    data = await res.json();
  } catch {
    return { error: 'Não deu para falar com o servidor para buscar a fatura.' };
  }

  if (!data?.transactions?.length) return null;
  if (getImportedSources().includes(data.sourceFile)) return null;

  try {
    const existingTransactions = transactionService.listForDuplicateCheck();
    const preview = importService.previewImportDrafts(data.transactions.map(toDraft), existingTransactions);
    const selection = getDefaultSelectedImportItems(preview);
    const result = commitImportSelection(selection, existingTransactions, 'nubank_credit_card');
    markSourceImported(data.sourceFile);

    // Which financial months got something to review — Revisar opens on the current one.
    const reviewMonths = [...new Set(result.importedTransactions.filter(isRequiredReviewTransaction).map(transactionMonthKey))].sort();
    return {
      imported: result.importedCount,
      skipped: result.skippedCount,
      sourceFile: data.sourceFile,
      reviewCount: result.reviewCount,
      reviewMonths,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao gravar a fatura importada.' };
  }
}
