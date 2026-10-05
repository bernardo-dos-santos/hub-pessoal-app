import { type Invoice, type InvoiceStatus } from '../types/invoice';
import { type Transaction } from '../types/transaction';
import { cardService } from './cardService';
import { transactionService } from './transactionService';

function padDate(n: number) {
  return String(n).padStart(2, '0');
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function getInvoicePeriod(
  year: number,
  month: number,
  closingDay: number,
  dueDay: number,
): { start: string; end: string; closingDate: string; dueDate: string } {
  // "Fatura de julho/2026" fecha em 2026-07-05, cobre 2026-06-06 → 2026-07-05
  const end = `${year}-${padDate(month)}-${padDate(closingDay)}`;
  const prev = addMonths(year, month, -1);
  const start = `${prev.year}-${padDate(prev.month)}-${padDate(closingDay + 1)}`;
  const next = addMonths(year, month, 1);
  const dueDate = `${next.year}-${padDate(next.month)}-${padDate(dueDay)}`;
  return { start, end, closingDate: end, dueDate };
}

function deriveStatus(
  period: { end: string; dueDate: string },
  today: string,
  allTransactions: Transaction[],
): InvoiceStatus {
  if (today <= period.end) return 'open';
  const hasPayment = allTransactions.some(
    (t) =>
      t.kind === 'card_payment' &&
      t.date >= period.end &&
      t.date <= period.dueDate,
  );
  return hasPayment ? 'paid' : 'closed';
}

function getInvoiceTransactionsForPeriod(
  transactions: Transaction[],
  cardAccountId: string,
  start: string,
  end: string,
): Transaction[] {
  return transactions.filter(
    (t) =>
      t.kind === 'card_purchase' &&
      t.accountId === cardAccountId &&
      t.date >= start &&
      t.date <= end,
  );
}

function deriveInvoices(
  transactions: Transaction[],
  cardId: string,
  cardAccountId: string,
  closingDay: number,
  dueDay: number,
  monthsBack = 6,
): Invoice[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${padDate(today.getMonth() + 1)}-${padDate(today.getDate())}`;

  // Encontra o mês da fatura aberta atual: primeiro mês cujo fechamento é >= hoje
  let refYear = today.getFullYear();
  let refMonth = today.getMonth() + 1;
  const closingThisMonth = `${refYear}-${padDate(refMonth)}-${padDate(closingDay)}`;
  if (todayStr > closingThisMonth) {
    const next = addMonths(refYear, refMonth, 1);
    refYear = next.year;
    refMonth = next.month;
  }

  const invoices: Invoice[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const { year, month } = addMonths(refYear, refMonth, -i);
    const period = getInvoicePeriod(year, month, closingDay, dueDay);
    const txs = getInvoiceTransactionsForPeriod(transactions, cardAccountId, period.start, period.end);
    const total = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const status = deriveStatus(period, todayStr, transactions);
    const id = `invoice-${cardId}-${year}-${padDate(month)}`;
    invoices.push({
      id,
      cardId,
      month,
      year,
      closingDate: period.closingDate,
      dueDate: period.dueDate,
      total,
      status,
      createdAt: period.start + 'T00:00:00.000Z',
      updatedAt: todayStr + 'T00:00:00.000Z',
    });
  }
  return invoices;
}

function getActiveCard() {
  return cardService.listCards().find((c) => c.type === 'credit' && c.isActive) ?? null;
}

export const invoiceService = {
  listInvoices(): Invoice[] {
    const card = getActiveCard();
    if (!card || !card.closingDay || !card.dueDay) return [];
    const transactions = transactionService.listTransactions();
    return deriveInvoices(transactions, card.id, card.accountId ?? card.id, card.closingDay, card.dueDay);
  },

  getInvoiceTransactions(invoice: Invoice): Transaction[] {
    const card = getActiveCard();
    if (!card || !invoice.closingDate) return [];
    const period = getInvoicePeriod(invoice.year, invoice.month, card.closingDay!, card.dueDay!);
    return getInvoiceTransactionsForPeriod(
      transactionService.listTransactions(),
      card.accountId ?? card.id,
      period.start,
      period.end,
    ).sort((a, b) => b.date.localeCompare(a.date));
  },

  getCurrentInvoice(): Invoice | null {
    return this.listInvoices().find((inv) => inv.status === 'open') ?? null;
  },

  getInvoiceById(id: string): Invoice | null {
    return this.listInvoices().find((inv) => inv.id === id) ?? null;
  },
};
