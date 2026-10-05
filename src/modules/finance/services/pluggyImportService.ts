import { specialCategories } from '../data/specialCategories';
import { mapPluggyCategory } from '../data/pluggyCategoryMap';
import { type ImportPreviewResult, type RawTransactionDraft } from '../types/import';
import { type Transaction } from '../types/transaction';
import { suggestCategory } from './categoryClassificationService';
import { pairInternalTransfers } from './internalTransferPairingService';
import { resolveHubAccount } from './pluggyAccountMappingService';
import { deduplicateImportPreview } from './transactionDeduplicationService';
import { normalizeTransactionDrafts } from './transactionNormalizationService';
import { transactionService } from './transactionService';

/**
 * Espelha o payload gravado por scripts/sync/pluggy-sync.js em
 * public/pluggy-pending.json (toPendingTransaction()). O script só extrai da API
 * da Pluggy — quem decide o que vira Transaction de verdade é o preview/revisão
 * do ImportPage, igual ao fluxo de CSV.
 */
type PluggyPendingAccount = {
  id: string;
  type: string;
  subtype: string;
  name: string;
  balance: number;
  currency: string;
  institution: string | null;
  creditLimit: number | null;
  dueDate: string | null;
};

type PluggyPendingTransaction = {
  externalId: string;
  date: string;
  description: string;
  originalDescription?: string;
  amount: number;
  currency?: string;
  pluggyCategory?: string | null;
  pluggyCategoryId?: string | null;
  status?: string | null;
  type?: string | null;
  merchant?: string | null;
  /** Nome da outra ponta do PIX/TED, quando o banco informa. */
  counterpart?: string | null;
  account: {
    id: string;
    type: string;
    subtype: string;
    name: string;
    number?: string | null;
  };
  institution?: string | null;
};

/**
 * Espelha toPendingInvestment() em scripts/sync/pluggy-sync.js. Sem posição real
 * pra validar (a conta de corretora testada não tinha nenhuma aberta) — os nomes
 * de campo seguem a documentação oficial da Pluggy (GET /investments), não dado
 * empírico. Revisar se o formato real destoar quando houver posição de verdade.
 */
export type PluggyPendingInvestment = {
  id: string;
  type: string | null;
  subtype: string | null;
  name: string;
  balance: number | null;
  amount: number | null;
  value: number | null;
  quantity: number | null;
  amountOriginal: number | null;
  amountProfit: number | null;
  currencyCode: string | null;
  date: string | null;
  institution: string | null;
};

export type PluggyPendingFile = {
  exportedAt: string;
  fromDate: string;
  accounts: PluggyPendingAccount[];
  transactions: PluggyPendingTransaction[];
  investments?: PluggyPendingInvestment[];
};

/**
 * A categoria da Pluggy entra só como último recurso: se o Hub já tem regra
 * manual ou alias que reconheça a descrição, a opinião dele vence (regra
 * manual tem prioridade sobre heurística). `needsReview` segue
 * a lógica normal — a categoria vem preenchida, mas a conferência continua.
 */
function categoryFallbackFromPluggy(tx: PluggyPendingTransaction): string | undefined {
  const hubGuess = suggestCategory({ description: tx.description, amount: tx.amount });
  if (!hubGuess.needsReview) return undefined;
  return mapPluggyCategory(tx.pluggyCategory);
}

/**
 * Traduz a transação da Pluggy pro vocabulário do Hub, usando a conta canônica
 * mapeada. Devolve null quando a conta ainda não foi mapeada — sem isso a
 * transação entraria com `accountId` UUID e `institution` "MeuPluggy",
 * escapando da deduplicação contra o que o sync por e-mail já importou.
 */
export function mapPluggyTransactionToDraft(tx: PluggyPendingTransaction): RawTransactionDraft | null {
  const hubAccount = resolveHubAccount(tx.account.id);
  if (!hubAccount) return null;

  return {
    // externalId da Pluggy é estável entre syncs — usar como id do draft dá
    // idempotência de verdade (resync não gera um id novo pra mesma transação).
    id: tx.externalId,
    date: tx.date.slice(0, 10),
    description: tx.description,
    originalDescription: tx.originalDescription ?? tx.description,
    amount: tx.amount,
    accountId: hubAccount.id,
    accountName: hubAccount.name,
    institution: hubAccount.institution,
    scope: hubAccount.scope,
    accountType: hubAccount.type,
    category: categoryFallbackFromPluggy(tx),
    source: 'pluggy',
  };
}

export async function fetchPluggyPendingFile(): Promise<PluggyPendingFile | null> {
  try {
    const res = await fetch('/pluggy-pending.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as PluggyPendingFile;
  } catch {
    return null;
  }
}

export type PluggyDraftsResult = {
  drafts: RawTransactionDraft[];
  /** Contas presentes no arquivo que ainda não têm conta do Hub correspondente. */
  unmappedAccounts: PluggyPendingAccount[];
  /** Transações ignoradas por pertencerem a uma conta não mapeada. */
  skippedForUnmappedAccount: number;
};

function absoluteAmount(value: number) {
  return Math.abs(Number(value) || 0);
}

function totalForCategory(transactions: { category: string; amount: number }[], category: string) {
  return transactions
    .filter((transaction) => transaction.category === category)
    .reduce((total, transaction) => total + absoluteAmount(transaction.amount), 0);
}

export type PluggyPreviewResult = {
  preview: ImportPreviewResult;
  pairedCount: number;
};

/**
 * Monta o preview da Pluggy na ordem certa: normaliza → pareia transferência
 * própria → só então deduplica e conta pendências.
 *
 * Não dá pra usar `importService.previewImportDrafts` direto e parear depois: os
 * avisos e o contador de revisão sairiam do passo anterior ao pareamento,
 * pedindo pra revisar lançamento que já virou transferência. O pareamento fica
 * só neste caminho porque o CSV dos bancos ainda traz a descrição completa que a
 * heurística de texto reconhece.
 */
export function buildPluggyPreview(
  drafts: RawTransactionDraft[],
  existingTransactions: Transaction[],
): PluggyPreviewResult {
  const normalized = normalizeTransactionDrafts(drafts);
  const { drafts: paired, pairedCount } = pairInternalTransfers(normalized, existingTransactions);
  const deduplicated = deduplicateImportPreview(paired, existingTransactions);

  return {
    pairedCount,
    preview: {
      totalRows: drafts.length,
      normalizedTransactions: paired,
      needsReviewCount: paired.filter((transaction) => transaction.needsReview).length,
      incomeReviewTotal: totalForCategory(paired, specialCategories.incomeReview),
      expenseReviewTotal: totalForCategory(paired, specialCategories.expenseReview),
      duplicateResults: deduplicated.duplicateResults,
      uniqueCount: deduplicated.uniqueCount,
      exactDuplicateCount: deduplicated.exactDuplicateCount,
      possibleDuplicateCount: deduplicated.possibleDuplicateCount,
      errors: [],
      warnings: [
        ...paired
          .filter((transaction) => transaction.needsReview)
          .map((transaction) => `Revisar "${transaction.description}": ${transaction.classificationReason}`),
        ...deduplicated.warnings,
      ],
    },
  };
}

export type PluggyAutoImportResult = {
  imported: number;
  /** Já estavam no Hub — resync não reimporta. */
  alreadyThere: number;
  /** Entraram, mas pedem conferência na aba Revisão. */
  needsReview: number;
  /** Ficaram de fora por estarem em conta ainda não mapeada. */
  unmapped: number;
} | null;

/**
 * Importa sozinho o que o sync trouxe, no mesmo espírito dos outros syncs do
 * Hub (SIGAA, Gmail, fatura): abrir o app já traz o que chegou.
 *
 * Exigir o preview manual a cada rodada fazia sentido na primeira carga, com
 * meses de histórico de uma vez; no dia a dia, obrigaria a abrir a tela de
 * importação toda vez pra ver meia dúzia de lançamentos novos.
 *
 * Nada entra sem classificação: o que a regra ou o alias resolve entra pronto,
 * o que sobra entra marcado pra revisão e aparece no badge da aba. O preview
 * manual continua disponível pra quem quiser conferir antes.
 *
 * Idempotente: o id do draft é o `externalId` da Pluggy, então uma transação já
 * salva é reconhecida na hora, sem depender de heurística de duplicata.
 */
export async function checkAndAutoImportPluggy(
  existingTransactions: Transaction[],
): Promise<PluggyAutoImportResult> {
  const data = await fetchPluggyPendingFile();
  if (!data?.transactions?.length) return null;

  const knownIds = new Set(existingTransactions.map((transaction) => transaction.id));
  const drafts: RawTransactionDraft[] = [];
  let unmapped = 0;
  let alreadyThere = 0;

  for (const transaction of data.transactions) {
    const draft = mapPluggyTransactionToDraft(transaction);
    if (!draft) {
      unmapped += 1;
      continue;
    }
    if (knownIds.has(String(draft.id))) {
      alreadyThere += 1;
      continue;
    }
    drafts.push(draft);
  }

  if (drafts.length === 0) {
    return { imported: 0, alreadyThere, needsReview: 0, unmapped };
  }

  const { preview } = buildPluggyPreview(drafts, existingTransactions);
  // Duplicata exata contra o que já existe fica de fora mesmo assim: protege o
  // caso de a mesma transação ter entrado antes por outra fonte (Gmail sync).
  const toImport = preview.normalizedTransactions.filter((transaction) => {
    const duplicate = preview.duplicateResults?.find((result) => result.transaction.id === transaction.id);
    return duplicate?.duplicateStatus !== 'exact_duplicate';
  });

  transactionService.addTransactions(toImport);

  return {
    imported: toImport.length,
    alreadyThere: alreadyThere + (preview.normalizedTransactions.length - toImport.length),
    needsReview: toImport.filter((transaction) => transaction.needsReview).length,
    unmapped,
  };
}

export const pluggyImportService = {
  fetchPluggyPendingFile,
  mapPluggyTransactionToDraft,
  buildPluggyPreview,
  checkAndAutoImportPluggy,

  async buildDraftsFromPendingFile(): Promise<PluggyDraftsResult> {
    const data = await fetchPluggyPendingFile();
    const transactions = data?.transactions ?? [];
    const drafts: RawTransactionDraft[] = [];
    let skippedForUnmappedAccount = 0;

    for (const transaction of transactions) {
      const draft = mapPluggyTransactionToDraft(transaction);
      if (draft) {
        drafts.push(draft);
      } else {
        skippedForUnmappedAccount += 1;
      }
    }

    const unmappedAccounts = (data?.accounts ?? []).filter((account) => !resolveHubAccount(account.id));

    return { drafts, unmappedAccounts, skippedForUnmappedAccount };
  },
};
