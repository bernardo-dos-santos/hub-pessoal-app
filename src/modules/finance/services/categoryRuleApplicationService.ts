import { specialCategories } from '../data/specialCategories';
import { type CategoryRule } from '../types/category';
import { type TransactionKind } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { categoryRuleService } from './categoryRuleService';
import { transactionService } from './transactionService';

export type RuleApplicationPreviewMatch = {
  transactionId: string;
  description: string;
  amount: number;
  date: string;
  currentCategory: string;
  currentKind: TransactionKind;
  newCategory: string;
  newKind: TransactionKind;
  matchedRuleId: string;
  matchedRuleKeyword: string;
  matchOrigin: 'required_review' | 'automatic_classification' | 'automatic_transfer';
  reason: string;
};

export type RuleApplicationPreviewSkipped = {
  transactionId: string;
  description: string;
  category: string;
  kind: TransactionKind;
  reason: string;
};

export type RuleApplicationPreview = {
  totalCandidates: number;
  totalMatches: number;
  totalSkipped: number;
  matches: RuleApplicationPreviewMatch[];
  skipped: RuleApplicationPreviewSkipped[];
};

export type RuleApplicationResult = {
  updatedCount: number;
  skippedCount: number;
  updatedTransactions: Transaction[];
  skipped: RuleApplicationPreviewSkipped[];
};

const protectedAutomaticKinds = new Set<TransactionKind>(['card_payment', 'card_payment_received', 'refund']);

function isReviewCategory(category: string) {
  return category === specialCategories.incomeReview || category === specialCategories.expenseReview;
}

function isExplicitCardPurchaseReview(transaction: Transaction) {
  return transaction.kind === 'card_purchase' && (transaction.needsReview || isReviewCategory(transaction.category));
}

function skip(transaction: Transaction, reason: string): RuleApplicationPreviewSkipped {
  return {
    transactionId: transaction.id,
    description: transaction.description,
    category: transaction.category,
    kind: transaction.kind,
    reason,
  };
}

function findExplicitRule(transaction: Transaction, rules: CategoryRule[], ignoreManualProtection = false) {
  const match = categoryRuleService.findMatchingCategoryRule({
    description: transaction.description,
    category: transaction.category,
    manualCategory: ignoreManualProtection ? false : transaction.manualCategory,
    scope: transaction.scope,
    accountType: transaction.accountType,
    source: transaction.source,
  });
  const rule = match ? rules.find((item) => item.id === match.ruleId) : null;

  if (!match || !rule) {
    return null;
  }

  return { match, rule };
}

function isAutomaticTransfer(transaction: Transaction) {
  return transaction.kind === 'transfer' || transaction.category === specialCategories.internalTransfer;
}

function createPreviewMatch(
  transaction: Transaction,
  rule: CategoryRule,
  matchOrigin: RuleApplicationPreviewMatch['matchOrigin'],
): RuleApplicationPreviewMatch {
  const reason =
    matchOrigin === 'required_review'
      ? 'Pendência corrigida por regra manual explícita.'
      : matchOrigin === 'automatic_transfer'
        ? 'Transferência interna automática sobrescrita por regra manual explícita.'
        : 'Classificação automática sobrescrita por regra manual explícita.';

  return {
    transactionId: transaction.id,
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date,
    currentCategory: transaction.category,
    currentKind: transaction.kind,
    newCategory: rule.category,
    newKind: rule.kind as TransactionKind,
    matchedRuleId: rule.id,
    matchedRuleKeyword: rule.keyword,
    matchOrigin,
    reason,
  };
}

function buildPreviewForTransaction(
  transaction: Transaction,
  rules: CategoryRule[],
  matchOrigin: RuleApplicationPreviewMatch['matchOrigin'],
) {
  if (transaction.manualCategory) {
    return { skipped: skip(transaction, 'manualCategory true: transação manual protegida.') };
  }

  if (protectedAutomaticKinds.has(transaction.kind)) {
    return { skipped: skip(transaction, 'Movimento neutro sensivel ja classificado; revise manualmente se precisar corrigir.') };
  }

  if (transaction.kind === 'card_purchase' && !isExplicitCardPurchaseReview(transaction)) {
    return { skipped: skip(transaction, 'Compra no cartao ja classificada fora da revisao explicita.') };
  }

  const explicitRule = findExplicitRule(transaction, rules);

  if (!explicitRule) {
    return { skipped: skip(transaction, 'Nenhuma regra manual ativa combinou com este lancamento elegivel.') };
  }

  if (!explicitRule.rule.kind) {
    return { skipped: skip(transaction, 'Regra em "Manter classificador" nao decide o tipo com seguranca em lote.') };
  }

  return { match: createPreviewMatch(transaction, explicitRule.rule, matchOrigin) };
}

function collectPreviewCandidates(rules: CategoryRule[]) {
  const requiredTransactions = transactionService.listRequiredReviewTransactions();
  const requiredIds = new Set(requiredTransactions.map((transaction) => transaction.id));
  const automaticRuleMatches = transactionService.listTransactions().filter((transaction) => {
    if (requiredIds.has(transaction.id)) {
      return false;
    }

    const explicitRule = findExplicitRule(transaction, rules, true);
    return Boolean(explicitRule?.rule.kind);
  });

  return [
    ...requiredTransactions.map((transaction) => ({
      transaction,
      matchOrigin: 'required_review' as const,
    })),
    ...automaticRuleMatches.map((transaction) => ({
      transaction,
      matchOrigin: isAutomaticTransfer(transaction)
        ? 'automatic_transfer' as const
        : 'automatic_classification' as const,
    })),
  ];
}

export const categoryRuleApplicationService = {
  previewApplyActiveRulesToEligibleTransactions(): RuleApplicationPreview {
    const activeRules = categoryRuleService.getActiveCategoryRules();
    const candidates = collectPreviewCandidates(activeRules);
    const matches: RuleApplicationPreviewMatch[] = [];
    const skipped: RuleApplicationPreviewSkipped[] = [];

    candidates.forEach(({ transaction, matchOrigin }) => {
      const previewItem = buildPreviewForTransaction(transaction, activeRules, matchOrigin);

      if (previewItem.match) {
        matches.push(previewItem.match);
      }

      if (previewItem.skipped) {
        skipped.push(previewItem.skipped);
      }
    });

    const preview = {
      totalCandidates: candidates.length,
      totalMatches: matches.length,
      totalSkipped: skipped.length,
      matches,
      skipped,
    };

    if (
      typeof window !== 'undefined'
      && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ) {
      console.warn('[finance] category rule application preview', {
        activeRuleKeywords: activeRules.map((rule) => rule.keyword),
        activeRulesCount: activeRules.length,
        candidatesCount: preview.totalCandidates,
        matchesCount: preview.totalMatches,
        skippedCount: preview.totalSkipped,
        skippedReasons: preview.skipped.map((item) => ({
          transactionId: item.transactionId,
          reason: item.reason,
        })),
      });
    }

    return preview;
  },

  applyActiveRulesToEligibleTransactions(selectedTransactionIds: string[]): RuleApplicationResult {
    const selectedIds = new Set(selectedTransactionIds);
    const preview = this.previewApplyActiveRulesToEligibleTransactions();
    const updatedTransactions: Transaction[] = [];
    const skipped = [...preview.skipped];

    preview.matches.forEach((match) => {
      if (!selectedIds.has(match.transactionId)) {
        skipped.push({
          transactionId: match.transactionId,
          description: match.description,
          category: match.currentCategory,
          kind: match.currentKind,
          reason: 'Match mantido fora da selecao confirmada.',
        });
        return;
      }

      const updatedTransaction = transactionService.updateTransaction(match.transactionId, {
        category: match.newCategory,
        kind: match.newKind,
        manualCategory: true,
        needsReview: false,
        classificationConfidence: 'high',
        classificationReason:
          match.matchOrigin === 'required_review'
            ? `Regra manual aplicada nas pendencias: ${match.matchedRuleKeyword} -> ${match.newCategory}.`
            : `Regra manual aplicada sobre classificacao automatica: ${match.matchedRuleKeyword} -> ${match.newCategory}.`,
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'rule_application',
      });

      if (updatedTransaction) {
        updatedTransactions.push(updatedTransaction);
      }
    });

    return {
      updatedCount: updatedTransactions.length,
      skippedCount: skipped.length,
      updatedTransactions,
      skipped,
    };
  },

  previewApplyActiveRulesToRequiredReviewTransactions(): RuleApplicationPreview {
    return this.previewApplyActiveRulesToEligibleTransactions();
  },

  applyActiveRulesToRequiredReviewTransactions(selectedTransactionIds: string[]): RuleApplicationResult {
    return this.applyActiveRulesToEligibleTransactions(selectedTransactionIds);
  },
};

export const {
  applyActiveRulesToEligibleTransactions,
  applyActiveRulesToRequiredReviewTransactions,
  previewApplyActiveRulesToEligibleTransactions,
  previewApplyActiveRulesToRequiredReviewTransactions,
} = categoryRuleApplicationService;
