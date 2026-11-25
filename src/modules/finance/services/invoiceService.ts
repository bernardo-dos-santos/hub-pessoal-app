import { type Invoice, type InvoiceStatus } from '../types/invoice';
import { type Transaction } from '../types/transaction';
import { cardService } from './cardService';
import type { Card as FinanceCard } from '../types/card';
import { transactionService } from './transactionService';
import { transactionMonthKey } from '../utils/financeCalculations';
import { getCurrentMonthKey } from '../utils/financePeriod';

function padDate(n: number) {
  return String(n).padStart(2, '0');
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** `YYYY-MM-DD` for a day of a month, clamped to its length (closing on the 31st closes on Feb 28). */
function dayIn(year: number, month: number, day: number) {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${padDate(month)}-${padDate(Math.min(day, last))}`;
}

function nextDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${padDate(next.getMonth() + 1)}-${padDate(next.getDate())}`;
}

function getInvoicePeriod(
  year: number,
  month: number,
  closingDay: number,
  dueDay: number,
): { start: string; end: string; closingDate: string; dueDate: string } {
  // "Fatura de julho/2026" fecha em 2026-07-05, cobre 2026-06-06 → 2026-07-05
  const end = dayIn(year, month, closingDay);
  const prev = addMonths(year, month, -1);
  const start = nextDay(dayIn(prev.year, prev.month, closingDay));
  // Due after the closing day = same month (closes 5th, due 12th → July 12);
  // otherwise the next one (closes 28th, due 5th → August 5). It used to be
  // always the next month, a month late in the common case.
  const dueMonth = dueDay > closingDay ? { year, month } : addMonths(year, month, 1);
  const dueDate = dayIn(dueMonth.year, dueMonth.month, dueDay);
  return { start, end, closingDate: end, dueDate };
}

function deriveStatus(
  period: { end: string; dueDate: string },
  total: number,
  today: string,
  allTransactions: Transaction[],
): InvoiceStatus {
  if (today <= period.end) return 'open';
  // Payments from the closing until the next closing count — paying a day late
  // still pays the bill — and they have to cover it (a partial payment doesn't).
  const [y, m, d] = period.end.split('-').map(Number);
  const nextClosing = dayIn(new Date(y, m, 1).getFullYear(), new Date(y, m, 1).getMonth() + 1, d);
  const paid = allTransactions
    .filter((t) => t.kind === 'card_payment' && t.date > period.end && t.date <= nextClosing)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return total > 0 && paid >= total - 0.01 ? 'paid' : 'closed';
}

/** Which card a bill is computed for: its account, and whether it's the first one. */
type CardRef = { accountId: string; primary: boolean };

/**
 * A line is the card's when it carries the card's account — or, with no account
 * at all (typed by hand, or imported before the person registered the card), when
 * it was paid on credit and this is the first card. Requiring the account left
 * every manual card purchase, and every one of a friend's, out of the bill; giving
 * them to every card would count them once per card.
 */
function belongsToCard(t: Transaction, card: CardRef) {
  if (t.accountId) return t.accountId === card.accountId;
  return card.primary && (t.kind === 'card_purchase' || t.method === 'credito');
}

/** Purchases and refunds of the card in the period — the bill is purchases minus refunds. */
function getInvoiceTransactionsForPeriod(
  transactions: Transaction[],
  card: CardRef,
  start: string,
  end: string,
): Transaction[] {
  return transactions.filter(
    (t) =>
      (t.kind === 'card_purchase' || (t.kind === 'refund' && t.amount > 0)) &&
      belongsToCard(t, card) &&
      t.date >= start &&
      t.date <= end,
  );
}

function invoiceTotal(transactions: Transaction[]) {
  const total = transactions.reduce((sum, t) => sum + (t.kind === 'refund' ? -Math.abs(t.amount) : Math.abs(t.amount)), 0);
  return Math.max(0, total);
}

function deriveInvoices(
  transactions: Transaction[],
  cardId: string,
  cardRef: CardRef,
  closingDay: number,
  dueDay: number,
  monthsBack = 6,
): Invoice[] {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${padDate(today.getMonth() + 1)}-${padDate(today.getDate())}`;

  // Encontra o mês da fatura aberta atual: primeiro mês cujo fechamento é >= hoje
  let refYear = today.getFullYear();
  let refMonth = today.getMonth() + 1;
  const closingThisMonth = dayIn(refYear, refMonth, closingDay);
  if (todayStr > closingThisMonth) {
    const next = addMonths(refYear, refMonth, 1);
    refYear = next.year;
    refMonth = next.month;
  }

  const invoices: Invoice[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const { year, month } = addMonths(refYear, refMonth, -i);
    const period = getInvoicePeriod(year, month, closingDay, dueDay);
    const txs = getInvoiceTransactionsForPeriod(transactions, cardRef, period.start, period.end);
    const total = invoiceTotal(txs);
    const status = deriveStatus(period, total, todayStr, transactions);
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

function listCreditCards(): FinanceCard[] {
  return cardService.listCards().filter((c) => c.type === 'credit' && c.isActive);
}

function refOf(card: FinanceCard, cards = listCreditCards()): CardRef {
  return { accountId: card.accountId ?? card.id, primary: cards[0]?.id === card.id };
}

function invoicesOf(card: FinanceCard, transactions: Transaction[], cards: FinanceCard[]): Invoice[] {
  if (!card.closingDay || !card.dueDay) return [];
  return deriveInvoices(transactions, card.id, refOf(card, cards), card.closingDay, card.dueDay);
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function addMonthKey(yyyyMM: string, n: number): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${padDate((total % 12) + 1)}`;
}

export type InstallmentPlan = {
  transaction: Transaction;
  /** Installment billed this month (1-based). */
  current: number;
  /** Installments still to pay, this month's included. */
  remaining: number;
  /** `YYYY-MM` of the last one. */
  endMonth: string;
};

/**
 * Card purchases in installments that still have some to pay. Months are
 * financial months (transactionMonthKey / getCurrentMonthKey): the calendar
 * slice ignored the start day and turned the month at 21h in UTC.
 */
function listInstallmentPlans(transactions: Transaction[], card: CardRef, currentMonth = getCurrentMonthKey()): InstallmentPlan[] {
  return transactions
    .filter((t) => t.kind === 'card_purchase' && t.installmentCount != null && t.installmentValue != null && belongsToCard(t, card))
    .map((t) => {
      const purchaseMonth = transactionMonthKey(t);
      const paid = Math.max(0, monthsBetween(purchaseMonth, currentMonth) - 1);
      return {
        transaction: t,
        current: paid + 1,
        remaining: Math.max(0, t.installmentCount! - paid),
        endMonth: addMonthKey(purchaseMonth, t.installmentCount!),
      };
    })
    .filter((plan) => plan.remaining > 0)
    .sort((a, b) => a.transaction.date.localeCompare(b.transaction.date));
}

export type CardUsage = {
  card: FinanceCard;
  open: Invoice | null;
  /** The last closed bill when it isn't paid yet — the one to pay now. */
  toPay: Invoice | null;
  /** Installments of older purchases still holding the limit (not in either bill). */
  installmentsAhead: number;
  used: number;
  /** Limit minus everything still owed; null without a limit. */
  free: number | null;
};

export const invoiceService = {
  listCreditCards,

  /** Bills of one card, or of every active credit card (alerts, Home, Íris context). */
  listInvoices(cardId?: string): Invoice[] {
    const cards = listCreditCards();
    const transactions = transactionService.listTransactions();
    return cards
      .filter((card) => !cardId || card.id === cardId)
      .flatMap((card) => invoicesOf(card, transactions, cards));
  },

  getInvoiceTransactions(invoice: Invoice): Transaction[] {
    const cards = listCreditCards();
    const card = cards.find((item) => item.id === invoice.cardId);
    if (!card || !card.closingDay || !card.dueDay || !invoice.closingDate) return [];
    const period = getInvoicePeriod(invoice.year, invoice.month, card.closingDay, card.dueDay);
    return getInvoiceTransactionsForPeriod(transactionService.listTransactions(), refOf(card, cards), period.start, period.end)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  listInstallmentPlans(cardId?: string): InstallmentPlan[] {
    const cards = listCreditCards();
    const card = cards.find((item) => item.id === cardId) ?? cards[0];
    return card ? listInstallmentPlans(transactionService.listTransactions(), refOf(card, cards)) : [];
  },

  /**
   * What a card owes and what's left of its limit (the first card when none is
   * given). The limit isn't freed when a bill closes, only when it's paid — so the
   * closed unpaid bill counts — and an installment purchase holds what's left of
   * it until the last one.
   */
  getCardUsage(cardId?: string): CardUsage | null {
    const cards = listCreditCards();
    const card = cards.find((item) => item.id === cardId) ?? cards[0];
    if (!card) return null;
    const transactions = transactionService.listTransactions();
    const invoices = invoicesOf(card, transactions, cards);
    const open = invoices.find((inv) => inv.status === 'open') ?? null;
    const lastClosed = invoices.find((inv) => inv.status !== 'open') ?? null;
    const toPay = lastClosed?.status === 'closed' && lastClosed.total > 0 ? lastClosed : null;
    // A purchase inside a counted bill is already there at its full value.
    const countedFrom = (toPay ?? open)?.createdAt.slice(0, 10) ?? '9999-12-31';
    const installmentsAhead = listInstallmentPlans(transactions, refOf(card, cards))
      .filter((plan) => plan.transaction.date < countedFrom)
      .reduce((sum, plan) => sum + plan.remaining * plan.transaction.installmentValue!, 0);
    const used = (open?.total ?? 0) + (toPay?.total ?? 0) + installmentsAhead;
    return {
      card,
      open,
      toPay,
      installmentsAhead,
      used,
      free: card.limit != null ? card.limit - used : null,
    };
  },

  /** Every active credit card's usage, in the order they were registered. */
  listCardUsages(): CardUsage[] {
    return listCreditCards()
      .map((card) => this.getCardUsage(card.id))
      .filter((usage): usage is CardUsage => usage !== null);
  },
};
