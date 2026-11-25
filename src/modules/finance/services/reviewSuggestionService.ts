import { specialCategories } from '../data/specialCategories';
import type { Category } from '../types/category';
import type { Transaction } from '../types/transaction';
import { extractMerchant, normalizeMoneyDescription } from '../utils/financeText';
import { suggestCategory } from './categoryClassificationService';

/**
 * Categories that are never offered as a one-tap answer: the "to review"
 * placeholders are the question itself, the transfer has its own button, and
 * card payments are a detailed-mode correction, not "what was this spent on".
 */
const notAnswers = new Set<string>([
  specialCategories.incomeReview,
  specialCategories.expenseReview,
  specialCategories.internalTransfer,
  specialCategories.cardPayment,
  specialCategories.cardPaymentReceived,
]);

function sameSign(a: number, b: number) {
  return (a < 0 && b < 0) || (a > 0 && b > 0);
}

function byCount(counts: Map<string, number>) {
  return [...counts.entries()].sort(([, a], [, b]) => b - a).map(([category]) => category);
}

/**
 * The few categories a pending transaction most likely belongs to, best first:
 * what this merchant was before, then what the classifier guesses, then the
 * categories the user uses most for money going the same way, then the
 * defaults. The review queue shows them as buttons so most items take one tap.
 */
export function suggestReviewCategories(
  transaction: Transaction,
  history: Transaction[],
  available: Category[],
  limit = 5,
): string[] {
  const picked: string[] = [];
  const add = (category: string | undefined) => {
    if (category && !notAnswers.has(category) && !picked.includes(category)) picked.push(category);
  };

  const merchant = normalizeMoneyDescription(extractMerchant(transaction.description));
  const others = history.filter(
    (item) => item.id !== transaction.id && sameSign(item.amount, transaction.amount) && !notAnswers.has(item.category),
  );

  if (merchant) {
    const sameMerchant = new Map<string, number>();
    for (const item of others) {
      if (normalizeMoneyDescription(extractMerchant(item.description)) === merchant) {
        sameMerchant.set(item.category, (sameMerchant.get(item.category) ?? 0) + 1);
      }
    }
    byCount(sameMerchant).forEach(add);
  }

  add(suggestCategory({ description: transaction.description, amount: transaction.amount, source: transaction.source }).category);

  const usage = new Map<string, number>();
  for (const item of others) usage.set(item.category, (usage.get(item.category) ?? 0) + 1);
  byCount(usage).forEach(add);

  const wantedType = transaction.amount > 0 ? 'income' : 'expense';
  available.filter((category) => (category.type ?? 'expense') === wantedType).forEach((category) => add(category.name));
  if (transaction.amount > 0) add(specialCategories.income);

  return picked.slice(0, limit);
}
