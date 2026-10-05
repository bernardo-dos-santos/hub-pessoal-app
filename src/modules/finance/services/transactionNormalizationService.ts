import { defaultAccounts } from '../data/defaultAccounts';
import { specialCategories } from '../data/specialCategories';
import {
  type AccountType,
  type FinanceScope,
  type TransactionKind,
  type TransactionMethod,
  type TransactionSource,
} from '../types/finance';
import { type NormalizedTransactionDraft, type RawTransactionDraft } from '../types/import';
import { containsAnyKeyword, containsKeyword, normalizeMoneyDescription } from '../utils/financeText';
import { classifyTransactionDraft } from './categoryClassificationService';

function findAccount(input: Pick<RawTransactionDraft, 'accountId' | 'accountName'>) {
  if (input.accountId) {
    const byId = defaultAccounts.find((account) => account.id === input.accountId);

    if (byId) {
      return byId;
    }
  }

  if (input.accountName) {
    const normalizedName = normalizeMoneyDescription(input.accountName);
    return defaultAccounts.find((account) => normalizeMoneyDescription(account.name) === normalizedName) ?? null;
  }

  return null;
}

function parseAmount(amount: RawTransactionDraft['amount']) {
  if (typeof amount === 'number') {
    return amount;
  }

  const normalized = String(amount)
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');

  return Number(normalized) || 0;
}

function normalizeDate(date: string) {
  const value = String(date || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const slashMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

function createDraftId(input: RawTransactionDraft) {
  const seed = `${input.date}|${input.description}|${input.amount}|${input.accountId ?? input.accountName ?? ''}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `finance-draft-${hash.toString(16)}`;
}

export function isRefundDescription(description = '') {
  return containsAnyKeyword(normalizeMoneyDescription(description), ['estorno', 'reembolso', 'refund']);
}

export function inferKindFromCategory(
  categoryName: string,
  currentKind: TransactionKind,
  amount: number,
  description = '',
): TransactionKind {
  const category = normalizeMoneyDescription(categoryName);

  if (category === normalizeMoneyDescription(specialCategories.incomeReview)) {
    return 'review';
  }

  if (category === normalizeMoneyDescription(specialCategories.expenseReview)) {
    return currentKind === 'card_purchase' ? 'card_purchase' : 'expense';
  }

  if (category === normalizeMoneyDescription(specialCategories.internalTransfer)) {
    return 'transfer';
  }

  if (category === normalizeMoneyDescription(specialCategories.cardPayment)) {
    return 'card_payment';
  }

  if (category === normalizeMoneyDescription(specialCategories.cardPaymentReceived)) {
    return 'card_payment_received';
  }

  if (category === normalizeMoneyDescription(specialCategories.income)) {
    return 'income';
  }

  if (category === normalizeMoneyDescription(specialCategories.investmentContribution)) {
    return 'investment_contribution';
  }

  if (category === normalizeMoneyDescription(specialCategories.investmentWithdrawal)) {
    return 'investment_withdrawal';
  }

  if (currentKind === 'refund' || (amount > 0 && isRefundDescription(description))) {
    return 'refund';
  }

  if (currentKind === 'card_purchase') {
    return 'card_purchase';
  }

  if (amount < 0) {
    return 'expense';
  }

  return currentKind;
}

export function shouldPreserveManualCategory(input: RawTransactionDraft) {
  return Boolean(input.category && input.manualCategory);
}

export function getDefaultSource(input: RawTransactionDraft): TransactionSource {
  return input.source ?? 'manual';
}

export function getDefaultMethod(input: RawTransactionDraft): TransactionMethod {
  if (input.method) {
    return input.method;
  }

  const description = normalizeMoneyDescription(input.description);
  const source = getDefaultSource(input);

  if (source === 'nubank_credit_card' || containsKeyword(description, 'compra no credito')) {
    return 'credito';
  }

  if (containsKeyword(description, 'pagamento de fatura')) {
    return 'fatura';
  }

  if (containsKeyword(description, 'pix')) {
    return 'pix';
  }

  if (containsKeyword(description, 'debito')) {
    return 'debito';
  }

  if (containsKeyword(description, 'credito')) {
    return 'credito';
  }

  if (containsKeyword(description, 'boleto')) {
    return 'boleto';
  }

  if (containsKeyword(description, 'dinheiro')) {
    return 'dinheiro';
  }

  return 'outro';
}

export function getDefaultAccountType(input: RawTransactionDraft): AccountType {
  if (input.accountType) {
    return input.accountType;
  }

  const account = findAccount(input);

  if (account) {
    return account.type;
  }

  if (getDefaultSource(input) === 'c6_business') {
    return 'business_checking';
  }

  if (getDefaultSource(input) === 'nubank_credit_card' || getDefaultMethod(input) === 'credito') {
    return 'credit_card';
  }

  return 'checking';
}

export function getDefaultScope(input: RawTransactionDraft): FinanceScope {
  if (input.scope) {
    return input.scope;
  }

  const account = findAccount(input);

  if (account) {
    return account.scope;
  }

  if (getDefaultSource(input) === 'c6_business' || getDefaultAccountType(input) === 'business_checking') {
    return 'empresa';
  }

  return 'pessoal';
}

export function normalizeTransactionDraft(input: RawTransactionDraft): NormalizedTransactionDraft {
  const amount = parseAmount(input.amount);
  const account = findAccount(input);
  const method = getDefaultMethod(input);
  const source = getDefaultSource(input);
  const scope = getDefaultScope(input);
  const accountType = getDefaultAccountType(input);
  const categoryProvided = Boolean(input.category);
  const classification = classifyTransactionDraft({
    description: input.description,
    amount,
    method,
    source,
    scope,
    accountType,
    category: input.category,
    manualCategory: shouldPreserveManualCategory(input),
  });
  const category = categoryProvided ? String(input.category) : classification.category;
  const kind = categoryProvided
    ? inferKindFromCategory(String(input.category), classification.kind, amount, input.description)
    : classification.kind;
  const manualCategory = Boolean(input.manualCategory || classification.manualCategory);
  const now = new Date().toISOString();

  return {
    id: input.id ?? createDraftId(input),
    date: normalizeDate(input.date),
    description: String(input.description || '').trim(),
    originalDescription: input.originalDescription ?? input.description,
    amount,
    category,
    categoryId: input.categoryId,
    accountId: input.accountId ?? account?.id,
    accountName: input.accountName ?? account?.name,
    institution: input.institution ?? account?.institution,
    scope,
    accountType,
    method,
    kind,
    source,
    notes: input.notes,
    manualCategory,
    needsReview: classification.needsReview,
    classificationConfidence: classification.confidence,
    classificationReason: categoryProvided
      ? `${manualCategory ? 'Categoria manual preservada.' : 'Categoria informada preservada.'} ${classification.reason}`
      : classification.reason,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeTransactionDrafts(inputs: RawTransactionDraft[]) {
  return inputs.map(normalizeTransactionDraft);
}
