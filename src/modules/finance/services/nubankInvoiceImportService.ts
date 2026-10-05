import { storageAdapter } from '../../../core/storage/storage.adapter';
import { categoryRuleService } from './categoryRuleService';
import { transactionService } from './transactionService';

const IMPORTED_SOURCES_KEY = 'finance.nubankInvoiceImportedSources';

type InvoiceTransaction = {
  date: string;
  description: string;
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

export type InvoiceImportResult = {
  imported: number;
  skipped: number;
  sourceFile: string;
} | null;

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

export async function checkAndAutoImportInvoice(): Promise<InvoiceImportResult> {
  try {
    const res = await fetch('/nubank-invoice-pending.json');
    if (!res.ok) return null;

    const data: InvoicePending = await res.json();
    if (!data?.transactions?.length) return null;

    const importedSources = getImportedSources();
    if (importedSources.includes(data.sourceFile)) return null;

    const existingTransactions = transactionService.listTransactions();
    let imported = 0;
    let skipped = 0;

    for (const tx of data.transactions) {
      // Dedup: mesma data + descrição + valor já existe?
      const isDuplicate = existingTransactions.some(
        (existing) =>
          existing.date === tx.date &&
          Math.abs(existing.amount - (tx.isRefund ? tx.amount : -tx.amount)) < 0.01,
      );

      if (isDuplicate) {
        skipped++;
        continue;
      }

      const description = buildDescription(tx);
      const ruleMatch = tx.isRefund ? null : categoryRuleService.findMatchingCategoryRule(description);

      transactionService.createTransaction({
        date: tx.date,
        description,
        originalDescription: tx.description,
        amount: tx.isRefund ? tx.amount : -tx.amount,
        category: ruleMatch?.category ?? (tx.isRefund ? 'Estorno' : 'Despesa a revisar'),
        categoryId: ruleMatch ? undefined : (tx.isRefund ? 'estorno' : 'despesa-a-revisar'),
        accountId: 'nubank-cartao',
        accountName: 'Nubank Cartão',
        institution: 'Nubank',
        scope: 'pessoal',
        accountType: 'credit_card',
        method: 'credito',
        kind: ruleMatch?.kind ?? (tx.isRefund ? 'refund' : 'card_purchase'),
        source: 'nubank_credit_card',
        manualCategory: ruleMatch ? true : false,
        needsReview: ruleMatch ? false : !tx.isRefund,
        classificationConfidence: ruleMatch?.confidence ?? 'low',
        classificationReason: ruleMatch
          ? `Regra manual: "${ruleMatch.ruleKeyword}" → ${ruleMatch.category}`
          : 'Importado da fatura PDF Nubank',
      });
      imported++;
    }

    if (imported > 0) {
      markSourceImported(data.sourceFile);
    }

    return { imported, skipped, sourceFile: data.sourceFile };
  } catch {
    return null;
  }
}
