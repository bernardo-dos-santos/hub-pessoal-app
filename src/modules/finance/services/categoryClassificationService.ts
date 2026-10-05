import { categoryAliasRules } from '../data/categoryAliases';
import { brokerIndicators, ownAccountIndicators, specialCategories } from '../data/specialCategories';
import {
  type AccountType,
  type ClassificationConfidence,
  type FinanceScope,
  type TransactionKind,
  type TransactionMethod,
  type TransactionSource,
} from '../types/finance';
import {
  containsAnyKeyword,
  containsKeyword,
  extractMerchant,
  isPaymentIntermediary,
  normalizeMoneyDescription,
  removePaymentIntermediaries,
} from '../utils/financeText';
import { categoryRuleService } from './categoryRuleService';

export type ClassificationInput = {
  description: string;
  amount: number;
  method?: TransactionMethod;
  kind?: TransactionKind;
  source?: TransactionSource;
  scope?: FinanceScope;
  accountType?: AccountType;
  category?: string;
  manualCategory?: boolean;
};

export type CategoryClassificationSuggestion = {
  category: string;
  kind: TransactionKind;
  confidence: ClassificationConfidence;
  reason: string;
  needsReview: boolean;
  manualCategory?: boolean;
};

function reviewCategoryForAmount(amount: number) {
  if (amount > 0) {
    return specialCategories.incomeReview;
  }

  if (amount < 0) {
    return specialCategories.expenseReview;
  }

  return specialCategories.other;
}

function hasOwnAccountIndicator(description: string) {
  return containsAnyKeyword(description, ownAccountIndicators);
}

function hasBrokerIndicator(description: string) {
  return containsAnyKeyword(description, brokerIndicators);
}

function matchCategoryByAliases(description: string) {
  const merchant = extractMerchant(description);
  const merchantWithoutIntermediaries = removePaymentIntermediaries(merchant);
  const descriptionWithoutIntermediaries = removePaymentIntermediaries(description);
  const searchTargets = [
    merchant && !isPaymentIntermediary(merchant) ? merchant : '',
    merchantWithoutIntermediaries,
    descriptionWithoutIntermediaries,
  ].filter(Boolean);

  const match = categoryAliasRules.find((rule) =>
    searchTargets.some((target) => rule.keywords.some((keyword) => containsKeyword(target, keyword))),
  );

  return match?.category ?? '';
}

function findManualCategoryRule(input: ClassificationInput) {
  return categoryRuleService.findMatchingCategoryRule({
    description: input.description,
    category: input.category,
    manualCategory: input.manualCategory,
    scope: input.scope,
    accountType: input.accountType,
    source: input.source,
  });
}

export function suggestTransactionKind(input: ClassificationInput): Pick<CategoryClassificationSuggestion, 'kind' | 'confidence' | 'reason'> {
  const description = normalizeMoneyDescription(input.description);

  if (input.kind === 'card_purchase') {
    return { kind: 'card_purchase', confidence: 'high', reason: 'Tipo de compra no cartão já informado.' };
  }

  if (containsAnyKeyword(description, ['estorno', 'reembolso'])) {
    return { kind: 'refund', confidence: 'high', reason: 'Descrição indica estorno ou reembolso.' };
  }

  if (containsKeyword(description, 'pagamento recebido')) {
    return { kind: 'card_payment_received', confidence: 'high', reason: 'Descrição indica pagamento recebido na fatura.' };
  }

  if (containsKeyword(description, 'pagamento de fatura')) {
    return { kind: 'card_payment', confidence: 'high', reason: 'Descrição indica pagamento de fatura.' };
  }

  if (input.source === 'nubank_credit_card' || input.method === 'credito' || containsKeyword(description, 'compra no credito')) {
    return { kind: 'card_purchase', confidence: 'high', reason: 'Origem, método ou descrição indicam compra no crédito.' };
  }

  if (containsAnyKeyword(description, ['transferencia recebida pelo pix', 'transferencia enviada pelo pix']) && hasOwnAccountIndicator(description)) {
    return { kind: 'transfer', confidence: 'high', reason: 'Descrição tem Pix entre contas com indício claro de conta própria.' };
  }

  if (Number(input.amount) > 0) {
    return { kind: 'review', confidence: 'low', reason: 'Entrada positiva sem origem confirmada deve ser revisada.' };
  }

  if (Number(input.amount) < 0) {
    return { kind: 'expense', confidence: 'medium', reason: 'Saída negativa sem indício de transferência própria.' };
  }

  return { kind: 'review', confidence: 'low', reason: 'Valor zerado ou insuficiente para classificação definitiva.' };
}

export function suggestCategory(input: ClassificationInput): Omit<CategoryClassificationSuggestion, 'kind'> {
  const description = normalizeMoneyDescription(input.description);

  if (input.manualCategory && input.category) {
    return {
      category: input.category,
      confidence: 'high',
      reason: 'Categoria manual preservada; classificação automática não sobrescreve escolha manual.',
      needsReview: false,
    };
  }

  const ruleMatch = findManualCategoryRule(input);

  if (ruleMatch) {
    return {
      category: ruleMatch.category,
      confidence: ruleMatch.kind ? 'high' : ruleMatch.confidence,
      reason: ruleMatch.reason,
      needsReview: false,
      manualCategory: true,
    };
  }

  if (containsAnyKeyword(description, ['estorno', 'reembolso'])) {
    return {
      category: specialCategories.other,
      confidence: 'medium',
      reason: 'Descrição indica estorno ou reembolso; categoria financeira fica como sugestão conservadora.',
      needsReview: true,
    };
  }

  if (containsKeyword(description, 'pagamento recebido')) {
    return {
      category: specialCategories.cardPaymentReceived,
      confidence: 'high',
      reason: 'Descrição indica pagamento recebido da fatura.',
      needsReview: false,
    };
  }

  if (containsKeyword(description, 'pagamento de fatura')) {
    return {
      category: specialCategories.cardPayment,
      confidence: 'high',
      reason: 'Descrição indica pagamento de fatura.',
      needsReview: false,
    };
  }

  if (containsAnyKeyword(description, ['transferencia recebida pelo pix', 'transferencia enviada pelo pix']) && hasOwnAccountIndicator(description)) {
    return {
      category: specialCategories.internalTransfer,
      confidence: 'high',
      reason: 'Descrição contém Pix com indício claro de conta própria.',
      needsReview: false,
    };
  }

  const aliasCategory = matchCategoryByAliases(input.description);

  if (aliasCategory) {
    return {
      category: aliasCategory,
      confidence: 'medium',
      reason: `Descrição ou estabelecimento combinou com aliases de ${aliasCategory}.`,
      needsReview: false,
    };
  }

  // Aporte é sugerido, nunca decidido sozinho: classificar errado tiraria uma
  // despesa real do resultado do mês, que é pior que pedir uma confirmação.
  if (hasBrokerIndicator(description) && Number(input.amount) < 0) {
    return {
      category: specialCategories.investmentContribution,
      confidence: 'medium',
      reason: 'Descrição menciona uma corretora — confirme se é aporte antes de tirar do resultado do mês.',
      needsReview: true,
    };
  }

  return {
    category: reviewCategoryForAmount(Number(input.amount)),
    confidence: 'low',
    reason: Number(input.amount) > 0 ? 'Pix ou entrada positiva desconhecida precisa de revisão.' : 'Saída desconhecida precisa de revisão.',
    needsReview: true,
  };
}

export function classifyTransactionDraft(input: ClassificationInput): CategoryClassificationSuggestion {
  if (input.manualCategory && input.category) {
    const categorySuggestion = suggestCategory(input);
    const kind = input.kind ?? suggestTransactionKind(input).kind;

    return {
      ...categorySuggestion,
      kind,
    };
  }

  const ruleMatch = findManualCategoryRule(input);

  if (ruleMatch?.kind && !(ruleMatch.kind === 'refund' && Number(input.amount) <= 0)) {
    return {
      category: ruleMatch.category,
      kind: ruleMatch.kind,
      confidence: 'high',
      reason: `${ruleMatch.reason} Tipo sugerido explicitamente pela regra manual.`,
      needsReview: false,
      manualCategory: true,
    };
  }

  const categorySuggestion = suggestCategory(input);
  const kindSuggestion = suggestTransactionKind({ ...input, category: categorySuggestion.category });
  const kind =
    categorySuggestion.category === specialCategories.incomeReview
      ? 'review'
      : categorySuggestion.category === specialCategories.expenseReview && kindSuggestion.kind !== 'card_purchase'
        ? 'expense'
        : kindSuggestion.kind;

  return {
    category: categorySuggestion.category,
    kind,
    confidence: kindSuggestion.confidence === 'high' ? categorySuggestion.confidence : kindSuggestion.confidence,
    reason: `${categorySuggestion.reason} ${kindSuggestion.reason}`,
    needsReview: categorySuggestion.needsReview || kindSuggestion.confidence === 'low',
    manualCategory: categorySuggestion.manualCategory,
  };
}
