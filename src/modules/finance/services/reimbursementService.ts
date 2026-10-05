import { generateId } from '../../../shared/utils/generateId';
import { specialCategories } from '../data/specialCategories';
import { type Transaction } from '../types/transaction';
import { isMatchedReimbursement } from '../utils/financeCalculations';
import { normalizeRuleText, normalizeText, matchesRuleKeyword } from '../utils/financeText';
import { isRefundDescription } from './transactionNormalizationService';
import { transactionService } from './transactionService';

const maximumAutomaticMatchDays = 14;

export type ReimbursementPairMatch = {
  pairId?: string;
  original: Transaction;
  refund: Transaction;
  reason: string;
};

export type ReimbursementRefundCandidate = {
  refund: Transaction;
  reason: string;
  status: 'unmatched' | 'ambiguous';
  possibleOriginalIds: string[];
};

export type ReimbursementDetectionResult = {
  matches: ReimbursementPairMatch[];
  unmatchedRefunds: ReimbursementRefundCandidate[];
  ambiguousRefunds: ReimbursementRefundCandidate[];
};

export type ReimbursementPair = {
  pairId: string;
  original: Transaction;
  refund: Transaction;
  matchedAt?: string;
};

function absoluteCents(value: number) {
  return Math.round(Math.abs(Number(value) || 0) * 100);
}

function dateValue(value: string) {
  return Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function daysBetween(firstDate: string, secondDate: string) {
  return Math.floor((dateValue(secondDate) - dateValue(firstDate)) / 86400000);
}

function categoryName(category: string) {
  return normalizeText(category);
}

function isNeutralCategory(category: string) {
  return [
    specialCategories.internalTransfer,
    specialCategories.cardPayment,
    specialCategories.cardPaymentReceived,
    specialCategories.incomeReview,
    specialCategories.expenseReview,
  ].some((specialCategory) => categoryName(category) === categoryName(specialCategory));
}

function isNeutralKind(kind: Transaction['kind']) {
  return kind === 'transfer' || kind === 'card_payment' || kind === 'card_payment_received' || kind === 'income';
}

function isEligibleRefund(transaction: Transaction) {
  return (
    !isMatchedReimbursement(transaction) &&
    transaction.amount > 0 &&
    isRefundDescription(transaction.description) &&
    !isNeutralCategory(transaction.category) &&
    transaction.kind !== 'transfer' &&
    transaction.kind !== 'card_payment' &&
    transaction.kind !== 'card_payment_received' &&
    transaction.kind !== 'income'
  );
}

function isEligibleOriginal(transaction: Transaction) {
  return (
    !isMatchedReimbursement(transaction) &&
    transaction.amount < 0 &&
    !isNeutralCategory(transaction.category) &&
    !isNeutralKind(transaction.kind)
  );
}

function valuesMatch(original: Transaction, refund: Transaction) {
  return absoluteCents(original.amount) === absoluteCents(refund.amount);
}

function categoriesMatch(original: Transaction, refund: Transaction) {
  return categoryName(original.category) === categoryName(refund.category);
}

function compatibleOptionalValue(first?: string, second?: string) {
  return !first || !second || normalizeText(first) === normalizeText(second);
}

function matchingOptionalValue(first?: string, second?: string) {
  return Boolean(first) && Boolean(second) && normalizeText(first!) === normalizeText(second!);
}

// "Sinal forte" (regra do módulo) exige mais que ausência de conflito: pelo
// menos um dos quatro campos precisa estar preenchido e igual dos dois lados.
// Antes, dois lançamentos sem nenhum desses campos preenchidos em nenhum dos
// lados (comum em lançamento manual) passavam como "compatíveis" só por
// omissão — pareava automaticamente sem nenhuma evidência real de mesma
// conta/origem. Auditoria em 2026-08-12 (revisão geral das regras do
// Financeiro) confirmou que isso enfraquecia a garantia documentada.
function accountsAndSourcesMatch(original: Transaction, refund: Transaction) {
  const noConflict =
    compatibleOptionalValue(original.source, refund.source) &&
    compatibleOptionalValue(original.accountId, refund.accountId) &&
    compatibleOptionalValue(original.accountName, refund.accountName) &&
    compatibleOptionalValue(original.institution, refund.institution);

  const hasPositiveSignal =
    matchingOptionalValue(original.accountId, refund.accountId) ||
    matchingOptionalValue(original.source, refund.source) ||
    matchingOptionalValue(original.accountName, refund.accountName) ||
    matchingOptionalValue(original.institution, refund.institution);

  return noConflict && hasPositiveSignal;
}

function datesMatch(original: Transaction, refund: Transaction) {
  const difference = daysBetween(original.date, refund.date);
  return difference >= 0 && difference <= maximumAutomaticMatchDays;
}

function descriptionsMatch(original: Transaction, refund: Transaction) {
  const originalDescription = normalizeRuleText(original.description);
  const refundDescription = normalizeRuleText(refund.description);

  if (!originalDescription || !refundDescription || originalDescription.length < 8) {
    return false;
  }

  return refundDescription.includes(originalDescription) || matchesRuleKeyword(refund.description, original.description);
}

function matchingOriginals(refund: Transaction, transactions: Transaction[]) {
  return transactions.filter((transaction) =>
    isEligibleOriginal(transaction) &&
    valuesMatch(transaction, refund) &&
    categoriesMatch(transaction, refund) &&
    accountsAndSourcesMatch(transaction, refund) &&
    descriptionsMatch(transaction, refund) &&
    datesMatch(transaction, refund),
  );
}

export function detectReimbursementPairs(transactions: Transaction[]): ReimbursementDetectionResult {
  const matches: ReimbursementPairMatch[] = [];
  const unmatchedRefunds: ReimbursementRefundCandidate[] = [];
  const ambiguousRefunds: ReimbursementRefundCandidate[] = [];
  const claimedOriginalIds = new Set<string>();

  transactions
    .filter(isEligibleRefund)
    .sort((first, second) => first.date.localeCompare(second.date))
    .forEach((refund) => {
      const originals = matchingOriginals(refund, transactions).filter((original) => !claimedOriginalIds.has(original.id));

      if (originals.length === 1) {
        claimedOriginalIds.add(originals[0].id);
        matches.push({
          original: originals[0],
          refund,
          reason: 'Compra e estorno têm valor exato, categoria, conta/origem e descrição compatíveis.',
        });
        return;
      }

      const candidate = {
        refund,
        possibleOriginalIds: originals.map((original) => original.id),
      };

      if (originals.length > 1) {
        ambiguousRefunds.push({
          ...candidate,
          status: 'ambiguous',
          reason: 'Pareamento ambíguo: mais de uma compra forte combina com este estorno.',
        });
        return;
      }

      unmatchedRefunds.push({
        ...candidate,
        status: 'unmatched',
        reason: 'Estorno sem compra negativa exata e segura na janela automática.',
      });
    });

  return { matches, unmatchedRefunds, ambiguousRefunds };
}

function applyPair(transactions: Transaction[], match: ReimbursementPairMatch, matchedAt: string) {
  const pairId = generateId('finance-reimbursement');

  return transactions.map((transaction) => {
    if (transaction.id !== match.original.id && transaction.id !== match.refund.id) {
      return transaction;
    }

    return {
      ...transaction,
      reimbursementPairId: pairId,
      reimbursementRole: transaction.id === match.original.id ? 'original' as const : 'refund' as const,
      reimbursementStatus: 'matched' as const,
      reimbursementMatchedAt: matchedAt,
      needsReview: false,
      reviewedAt: matchedAt,
      reviewedBy: 'reimbursement_pairing' as const,
      classificationReason: 'Par de estorno/reembolso detectado automaticamente.',
      updatedAt: matchedAt,
    };
  });
}

function groupStoredPairs(transactions: Transaction[]) {
  const transactionsByPair = new Map<string, Transaction[]>();

  transactions.filter(isMatchedReimbursement).forEach((transaction) => {
    const stored = transactionsByPair.get(transaction.reimbursementPairId as string) ?? [];
    transactionsByPair.set(transaction.reimbursementPairId as string, [...stored, transaction]);
  });

  return [...transactionsByPair.entries()]
    .map(([pairId, pairTransactions]) => ({
      pairId,
      original: pairTransactions.find((transaction) => transaction.reimbursementRole === 'original'),
      refund: pairTransactions.find((transaction) => transaction.reimbursementRole === 'refund'),
    }))
    .filter((pair): pair is { pairId: string; original: Transaction; refund: Transaction } => Boolean(pair.original && pair.refund))
    .map((pair) => ({
      ...pair,
      matchedAt: pair.refund.reimbursementMatchedAt ?? pair.original.reimbursementMatchedAt,
    }));
}

export const reimbursementService = {
  detectReimbursementPairs,

  applyReimbursementPairs() {
    let transactions = transactionService.listTransactions();
    const detection = detectReimbursementPairs(transactions);
    const matchedAt = new Date().toISOString();

    detection.matches.forEach((match) => {
      transactions = applyPair(transactions, match, matchedAt);
    });

    if (detection.matches.length > 0) {
      transactionService.replaceTransactions(transactions);
    }

    return {
      ...detection,
      pairs: groupStoredPairs(transactions),
    };
  },

  listReimbursementPairs() {
    return groupStoredPairs(transactionService.listTransactions());
  },

  listUnmatchedRefundCandidates() {
    const detection = detectReimbursementPairs(transactionService.listTransactions());
    return [...detection.unmatchedRefunds, ...detection.ambiguousRefunds];
  },

  unpairReimbursementPair(pairId: string) {
    const transactions = transactionService.listTransactions();
    const hasPair = transactions.some((transaction) => transaction.reimbursementPairId === pairId);

    if (!hasPair) {
      return false;
    }

    transactionService.replaceTransactions(
      transactions.map((transaction) =>
        transaction.reimbursementPairId === pairId
          ? {
              ...transaction,
              reimbursementPairId: undefined,
              reimbursementRole: undefined,
              reimbursementStatus: undefined,
              reimbursementMatchedAt: undefined,
              updatedAt: new Date().toISOString(),
            }
          : transaction,
      ),
    );
    return true;
  },
};

export const {
  applyReimbursementPairs,
  listReimbursementPairs,
  listUnmatchedRefundCandidates,
  unpairReimbursementPair,
} = reimbursementService;
