import { isRealExpense } from '../../../shared/finance/financeTotals.js';
import type { Transaction } from '../types/transaction';
import { filterTransactionsBySelectedMonth } from '../utils/financeCalculations';
import { getPreviousMonthKey } from '../utils/financePeriod';
import { extractMerchant, isGenericMerchant, normalizeMoneyDescription } from '../utils/financeText';

/** How many earlier months are looked at, and in how many a payee must show up. */
const LOOKBACK_MONTHS = 3;
const MIN_MONTHS_SEEN = 2;
/** The same bill varies a little (energy, phone); a wide swing is not a fixed cost. */
const MAX_DEVIATION = 0.3;

export type UpcomingFixedCost = {
  merchant: string;
  /** Typical amount (median of the months it was paid), positive. */
  amount: number;
};

function payeeOf(transaction: Transaction) {
  const merchant = extractMerchant(transaction.description);
  return isGenericMerchant(merchant) ? null : { key: normalizeMoneyDescription(merchant), label: merchant };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Bills that come back every month (rent, internet, a subscription) and haven't
 * been paid in `month` yet. "Dá para gastar R$ X por dia" divided the whole
 * balance by the days left, so on the 3rd it counted the rent due on the 10th
 * as money free to spend.
 *
 * A payee is a fixed cost when it was paid in at least 2 of the last 3 months
 * with a stable amount (each month's total within 30% of the median). Generic
 * descriptions ("Pix enviado") are skipped — they would lump every Pix together.
 */
export function listUpcomingFixedCosts(transactions: Transaction[], month: string): UpcomingFixedCost[] {
  const seen = new Map<string, { label: string; totals: number[] }>();
  let previous = month;
  for (let i = 0; i < LOOKBACK_MONTHS; i++) {
    previous = getPreviousMonthKey(previous);
    const totals = new Map<string, { label: string; total: number }>();
    for (const transaction of filterTransactionsBySelectedMonth(transactions, previous)) {
      if (!isRealExpense(transaction)) continue;
      const payee = payeeOf(transaction);
      if (!payee) continue;
      const entry = totals.get(payee.key) ?? { label: payee.label, total: 0 };
      entry.total += Math.abs(transaction.amount);
      totals.set(payee.key, entry);
    }
    for (const [key, { label, total }] of totals) {
      const entry = seen.get(key) ?? { label, totals: [] };
      entry.totals.push(total);
      seen.set(key, entry);
    }
  }

  const paidThisMonth = new Set(
    filterTransactionsBySelectedMonth(transactions, month)
      .filter(isRealExpense)
      .map((transaction) => payeeOf(transaction)?.key)
      .filter(Boolean),
  );

  return [...seen.entries()]
    .filter(([key, { totals }]) => {
      if (totals.length < MIN_MONTHS_SEEN || paidThisMonth.has(key)) return false;
      const typical = median(totals);
      return typical > 0 && totals.every((total) => Math.abs(total - typical) <= typical * MAX_DEVIATION);
    })
    .map(([, { label, totals }]) => ({ merchant: label, amount: Math.round(median(totals) * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}
