import { specialCategories } from '../data/specialCategories';
import { type NormalizedTransactionDraft } from '../types/import';
import { type Transaction } from '../types/transaction';

/**
 * Detecta transferência entre contas do próprio usuário pareando as duas pontas,
 * em vez de ler a descrição.
 *
 * A heurística por texto (`suggestTransactionKind`) exige "transferencia enviada
 * pelo pix" + o nome do titular, formato que só o sync por e-mail produz. O
 * extrato do Open Finance vem seco ("TRANSF ENVIADA PIX"), então toda
 * transferência própria virava despesa real de um lado e entrada a revisar do
 * outro — inflando o gasto do mês por dinheiro que nunca saiu do bolso.
 *
 * Casar por palavra-chave não serve: um PIX pra terceiro tem exatamente a mesma
 * descrição, e marcá-lo como neutro esconderia despesa real — erro pior que o
 * original. Por isso o pareamento exige a contrapartida existir: mesmo valor,
 * sinais opostos, datas próximas e contas diferentes (ambas conhecidas do Hub,
 * portanto ambas do usuário). Sem par completo, nada é alterado.
 */

const MAX_DAYS_APART = 2;

/** Só mexe no que ainda não tem classificação forte. */
const REPAIRABLE_KINDS = new Set(['expense', 'income', 'review']);

function cents(amount: number) {
  return Math.round(Number(amount) * 100);
}

function daysBetween(firstDate: string, secondDate: string) {
  const first = new Date(`${firstDate}T00:00:00`).getTime();
  const second = new Date(`${secondDate}T00:00:00`).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return Number.POSITIVE_INFINITY;
  return Math.abs(first - second) / 86_400_000;
}

function isPairable(transaction: Pick<Transaction, 'kind' | 'accountId' | 'manualCategory'>) {
  // Categoria escolhida à mão é decisão explícita do usuário — nunca sobrescrever.
  return !transaction.manualCategory && REPAIRABLE_KINDS.has(transaction.kind) && Boolean(transaction.accountId);
}

function asInternalTransfer(draft: NormalizedTransactionDraft, counterpartAccount: string): NormalizedTransactionDraft {
  return {
    ...draft,
    kind: 'transfer',
    category: specialCategories.internalTransfer,
    needsReview: false,
    classificationConfidence: 'high',
    classificationReason: `Par encontrado em ${counterpartAccount}: mesmo valor, sinal oposto e data próxima entre contas próprias.`,
    updatedAt: new Date().toISOString(),
  };
}

export type InternalTransferPairingResult = {
  drafts: NormalizedTransactionDraft[];
  pairedCount: number;
};

/**
 * Marca como transferência interna os drafts que têm contrapartida — seja em
 * outro draft do mesmo lote, seja numa transação já salva no Hub.
 */
export function pairInternalTransfers(
  drafts: NormalizedTransactionDraft[],
  existingTransactions: Transaction[] = [],
): InternalTransferPairingResult {
  const result = [...drafts];
  const alreadyPaired = new Set<number>();
  let pairedCount = 0;

  for (let index = 0; index < result.length; index += 1) {
    if (alreadyPaired.has(index)) continue;

    const draft = result[index];
    if (!isPairable(draft)) continue;

    // 1) contrapartida dentro do próprio lote (as duas pontas chegaram juntas)
    const counterpartIndex = result.findIndex((candidate, candidateIndex) => {
      if (candidateIndex === index || alreadyPaired.has(candidateIndex)) return false;
      if (!isPairable(candidate)) return false;

      return (
        candidate.accountId !== draft.accountId &&
        cents(candidate.amount) === -cents(draft.amount) &&
        daysBetween(candidate.date, draft.date) <= MAX_DAYS_APART
      );
    });

    if (counterpartIndex !== -1) {
      const counterpart = result[counterpartIndex];
      result[index] = asInternalTransfer(draft, counterpart.accountName ?? 'outra conta');
      result[counterpartIndex] = asInternalTransfer(counterpart, draft.accountName ?? 'outra conta');
      alreadyPaired.add(index);
      alreadyPaired.add(counterpartIndex);
      pairedCount += 2;
      continue;
    }

    // 2) contrapartida já salva no Hub (a outra ponta veio num import anterior)
    const existingCounterpart = existingTransactions.find(
      (candidate) =>
        isPairable(candidate) &&
        candidate.accountId !== draft.accountId &&
        cents(candidate.amount) === -cents(draft.amount) &&
        daysBetween(candidate.date, draft.date) <= MAX_DAYS_APART,
    );

    if (existingCounterpart) {
      result[index] = asInternalTransfer(draft, existingCounterpart.accountName ?? 'outra conta');
      alreadyPaired.add(index);
      pairedCount += 1;
    }
  }

  return { drafts: result, pairedCount };
}

export const internalTransferPairingService = {
  pairInternalTransfers,
};
