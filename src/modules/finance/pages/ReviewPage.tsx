import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select, DateField } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { EmptyFinanceState } from '../components/EmptyFinanceState';
import { specialCategories } from '../data/specialCategories';
import {
  categoryRuleApplicationService,
  type RuleApplicationPreview,
} from '../services/categoryRuleApplicationService';
import { categoryRuleService } from '../services/categoryRuleService';
import { categoryService } from '../services/categoryService';
import { inferKindFromCategory } from '../services/transactionNormalizationService';
import { transactionService } from '../services/transactionService';
import { type TransactionKind } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { isMatchedReimbursement, isRealExpense, isRealIncome } from '../utils/financeCalculations';
import {
  formatClassificationConfidence,
  formatCurrency,
  formatDate,
  formatTransactionKind,
  formatTransactionMethod,
} from '../utils/financeFormatters';
import { formatMonthLabel, isValidMonthKey, withReimbursementsParams } from '../utils/financePeriod';
import { extractMerchant } from '../utils/financeText';

type ReviewFilter =
  | 'required'
  | 'income_review'
  | 'expense_review'
  | 'transfers'
  | 'card_payments'
  | 'card_payment_received'
  | 'neutral'
  | 'low_confidence'
  | 'reviewed';

type ReviewDraft = Pick<Transaction, 'category' | 'kind'> & {
  notes: string;
  isInstallment: boolean;
  installmentCount: string;
  installmentValue: string;
};

const kindOptions: TransactionKind[] = [
  'income',
  'expense',
  'transfer',
  'card_purchase',
  'card_payment',
  'card_payment_received',
  'refund',
  'review',
];

const filters: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'required', label: 'Revisão necessária' },
  { id: 'income_review', label: 'Entrada a revisar' },
  { id: 'expense_review', label: 'Despesa a revisar' },
  { id: 'transfers', label: 'Transferências' },
  { id: 'card_payments', label: 'Pgto. fatura' },
  { id: 'card_payment_received', label: 'Pgto. recebido' },
  { id: 'neutral', label: 'Opcional' },
  { id: 'low_confidence', label: 'Baixa confiança' },
  { id: 'reviewed', label: 'Revisadas' },
];

function createDraft(transaction: Transaction): ReviewDraft {
  return {
    category: transaction.category,
    kind: transaction.kind,
    notes: transaction.notes ?? '',
    isInstallment: transaction.installmentCount != null,
    installmentCount: transaction.installmentCount != null ? String(transaction.installmentCount) : '',
    installmentValue: transaction.installmentValue != null ? String(transaction.installmentValue) : '',
  };
}

function transactionStatus(transaction: Transaction) {
  if (isMatchedReimbursement(transaction)) {
    return 'Reembolso pareado';
  }

  if (transaction.reviewedAt && !transaction.needsReview) {
    return 'Revisada';
  }

  if (transaction.category === specialCategories.incomeReview || transaction.category === specialCategories.expenseReview) {
    return 'Pendente de revisão';
  }

  if (transaction.needsReview || transaction.kind === 'review') {
    return 'Pendente de revisão';
  }

  if (transaction.classificationConfidence === 'low') {
    return 'Baixa confiança';
  }

  return 'Conferência opcional';
}

function transactionStatusColor(transaction: Transaction): string {
  return transactionStatus(transaction) === 'Conferência opcional'
    ? 'color-mix(in srgb, var(--hub-accent) 75%, transparent)'
    : 'var(--hub-warning)';
}

function categoryColor(category: string): string {
  if (category === specialCategories.incomeReview) return 'var(--hub-warning)';
  if (category === specialCategories.expenseReview) return 'var(--hub-negative)';
  if (category === specialCategories.internalTransfer) return 'var(--hub-accent)';
  return 'var(--hub-muted)';
}

function isNeutralResult(transaction: Transaction) {
  return !isRealIncome(transaction) && !isRealExpense(transaction);
}

export function ReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const selectedMonth = isValidMonthKey(monthParam) ? monthParam : null;
  const [allTransactions, setAllTransactions] = useState(() => transactionService.listTransactions());
  const [requiredTransactions, setRequiredTransactions] = useState(() => transactionService.listRequiredReviewTransactions());
  const [optionalTransactions, setOptionalTransactions] = useState(() => transactionService.listOptionalCheckTransactions());
  const [reviewableTransactions, setReviewableTransactions] = useState(() => transactionService.listReviewableTransactions());
  const [filter, setFilter] = useState<ReviewFilter>('required');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(() => transactionService.listRequiredReviewTransactions()[0]?.id ?? null);
  const [draft, setDraft] = useState<ReviewDraft | null>(() => {
    const firstTransaction = transactionService.listRequiredReviewTransactions()[0];
    return firstTransaction ? createDraft(firstTransaction) : null;
  });
  const [message, setMessage] = useState('');
  const [ruleKeyword, setRuleKeyword] = useState('');
  const [ruleMessage, setRuleMessage] = useState('');
  const [ruleApplicationPreview, setRuleApplicationPreview] = useState<RuleApplicationPreview | null>(null);
  const [selectedRuleApplicationIds, setSelectedRuleApplicationIds] = useState<string[]>([]);
  const pendingReviewCount = requiredTransactions.length;

  const optionalIds = useMemo(() => new Set(optionalTransactions.map((transaction) => transaction.id)), [optionalTransactions]);

  // Contagem por filtro para exibir nos botões
  const filterCounts = useMemo(() => {
    const base = (pred: (t: typeof allTransactions[0]) => boolean) =>
      reviewableTransactions.filter(pred).length;
    return {
      required: requiredTransactions.length,
      income_review:  base((t) => t.category === specialCategories.incomeReview),
      expense_review: base((t) => t.category === specialCategories.expenseReview),
      transfers:      base((t) => t.kind === 'transfer' || t.category === specialCategories.internalTransfer),
      card_payments:  base((t) => t.kind === 'card_payment' || t.category === specialCategories.cardPayment),
      card_payment_received: base((t) => t.kind === 'card_payment_received' || t.category === specialCategories.cardPaymentReceived),
      neutral:        optionalTransactions.length,
      low_confidence: base((t) => t.classificationConfidence === 'low'),
      reviewed:       allTransactions.filter((t) => Boolean(t.reviewedAt)).length,
    } as Record<string, number>;
  }, [allTransactions, optionalTransactions, requiredTransactions, reviewableTransactions]);
  const categoryOptions = useMemo(
    () => [...new Set([...categoryService.getAvailableCategories().map((category) => category.name), ...allTransactions.map((item) => item.category)])].sort(),
    [allTransactions],
  );
  const pendingOutsideSelectedMonth = selectedMonth
    ? requiredTransactions.filter((transaction) => !transaction.date.startsWith(selectedMonth)).length
    : 0;

  const filteredTransactions = useMemo(() => {
    const candidateTransactions = filter === 'reviewed'
      ? allTransactions.filter((transaction) => Boolean(transaction.reviewedAt))
      : filter === 'required'
        ? requiredTransactions
        : reviewableTransactions;
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

    return candidateTransactions.filter((transaction) => {
      const searchMatch =
        !normalizedSearch ||
        `${transaction.description} ${transaction.originalDescription ?? ''}`
          .toLocaleLowerCase('pt-BR')
          .includes(normalizedSearch);

      if (!searchMatch) {
        return false;
      }

      if (selectedMonth && !transaction.date.startsWith(selectedMonth)) {
        return false;
      }

      if (filter === 'income_review') {
        return transaction.category === specialCategories.incomeReview;
      }

      if (filter === 'expense_review') {
        return transaction.category === specialCategories.expenseReview;
      }

      if (filter === 'transfers') {
        return transaction.kind === 'transfer' || transaction.category === specialCategories.internalTransfer;
      }

      if (filter === 'card_payments') {
        return transaction.kind === 'card_payment' || transaction.category === specialCategories.cardPayment;
      }

      if (filter === 'card_payment_received') {
        return transaction.kind === 'card_payment_received' || transaction.category === specialCategories.cardPaymentReceived;
      }

      if (filter === 'neutral') {
        return optionalIds.has(transaction.id);
      }

      if (filter === 'low_confidence') {
        return transaction.classificationConfidence === 'low';
      }

      return true;
    });
  }, [allTransactions, filter, optionalIds, requiredTransactions, reviewableTransactions, search, selectedMonth]);

  const activeTransaction =
    filteredTransactions.find((transaction) => transaction.id === activeId) ?? filteredTransactions[0] ?? null;

  useEffect(() => {
    setDraft(activeTransaction ? createDraft(activeTransaction) : null);
    setRuleKeyword(activeTransaction ? extractMerchant(activeTransaction.description) : '');
    setRuleMessage('');
  }, [activeTransaction?.id]);

  function refreshReviewData(nextActiveId?: string | null) {
    setAllTransactions(transactionService.listTransactions());
    setRequiredTransactions(transactionService.listRequiredReviewTransactions());
    setOptionalTransactions(transactionService.listOptionalCheckTransactions());
    setReviewableTransactions(transactionService.listReviewableTransactions());
    setActiveId(nextActiveId ?? null);
  }

  function nextIdAfter(transactionId: string) {
    const currentIndex = filteredTransactions.findIndex((transaction) => transaction.id === transactionId);
    return filteredTransactions[currentIndex + 1]?.id ?? filteredTransactions[0]?.id ?? null;
  }

  function saveAndNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeTransaction || !draft) {
      return;
    }

    const showInstallment = draft.kind === 'card_purchase' && Math.abs(activeTransaction.amount) > 200;
    const n = parseInt(draft.installmentCount);
    const installmentCount = showInstallment && draft.isInstallment && !isNaN(n) && n >= 2 ? n : undefined;
    const parsedValue = draft.installmentValue !== '' ? parseFloat(draft.installmentValue.replace(',', '.')) : undefined;
    const installmentValue = installmentCount != null
      ? (parsedValue ?? Math.abs(activeTransaction.amount) / installmentCount)
      : undefined;

    transactionService.reviewTransaction(activeTransaction.id, {
      category: draft.category.trim() || activeTransaction.category,
      kind: draft.kind,
      notes: draft.notes.trim() || undefined,
      needsReview: false,
      reviewedBy: 'review_page',
      ...(installmentCount != null ? { installmentCount, installmentValue } : {}),
    });
    refreshReviewData(nextIdAfter(activeTransaction.id));
    setMessage('Revisão salva.');
  }

  function runQuickAction(updates: Parameters<typeof transactionService.reviewTransaction>[1], message: string) {
    if (!activeTransaction) {
      return;
    }

    transactionService.reviewTransaction(activeTransaction.id, {
      ...updates,
      reviewedBy: updates.needsReview ? undefined : 'quick_action',
    });
    refreshReviewData(nextIdAfter(activeTransaction.id));
    setMessage(message);
  }

  function markReviewed() {
    if (!activeTransaction) {
      return;
    }

    transactionService.markTransactionReviewed(activeTransaction.id);
    refreshReviewData(nextIdAfter(activeTransaction.id));
    setMessage('Transação marcada como revisada.');
  }

  function skip() {
    if (!activeTransaction) {
      return;
    }

    setActiveId(nextIdAfter(activeTransaction.id));
    setMessage('Item pulado por enquanto.');
  }

  function previewRuleApplication() {
    const preview = categoryRuleApplicationService.previewApplyActiveRulesToEligibleTransactions();

    setRuleApplicationPreview(preview);
    setSelectedRuleApplicationIds(preview.matches.map((match) => match.transactionId));
    setMessage('');
  }

  function toggleRuleApplicationSelection(transactionId: string) {
    setSelectedRuleApplicationIds((currentIds) =>
      currentIds.includes(transactionId)
        ? currentIds.filter((id) => id !== transactionId)
        : [...currentIds, transactionId],
    );
  }

  function cancelRuleApplication() {
    setRuleApplicationPreview(null);
    setSelectedRuleApplicationIds([]);
  }

  function confirmRuleApplication() {
    const result = categoryRuleApplicationService.applyActiveRulesToEligibleTransactions(selectedRuleApplicationIds);

    refreshReviewData();
    setRuleApplicationPreview(null);
    setSelectedRuleApplicationIds([]);
    setMessage(`${result.updatedCount} lançamento${result.updatedCount === 1 ? '' : 's'} atualizado${result.updatedCount === 1 ? '' : 's'} por regras ativas.`);
  }

  function changeSelectedMonth(value: string) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (isValidMonthKey(value)) {
      nextSearchParams.set('month', value);
    } else {
      nextSearchParams.delete('month');
    }

    setSearchParams(nextSearchParams);
    setActiveId(null);
  }

  function createRuleForCurrentTransaction() {
    if (!activeTransaction || !draft) {
      return;
    }

    try {
      const rule = categoryRuleService.createRuleFromTransaction(activeTransaction, draft.category, ruleKeyword, draft.kind);
      setRuleMessage(`Regra criada: "${rule.keyword}" → ${rule.category}. Usada em novas importações.`);
    } catch (ruleError) {
      setRuleMessage(ruleError instanceof Error ? ruleError.message : 'Não foi possível criar a regra.');
    }
  }

  function createRuleAndApplyCurrentTransaction() {
    if (!activeTransaction || !draft) {
      return;
    }

    try {
      const rule = categoryRuleService.createRuleFromTransaction(activeTransaction, draft.category, ruleKeyword, draft.kind);

      transactionService.reviewTransaction(activeTransaction.id, {
        category: draft.category.trim() || activeTransaction.category,
        kind: draft.kind,
        notes: draft.notes.trim() || undefined,
        needsReview: false,
        reviewedBy: 'review_page',
      });
      refreshReviewData(nextIdAfter(activeTransaction.id));

      // A regra vale pra todo lançamento parecido, não só pro que está aberto:
      // sem isto, criar a regra do iFood no meio de centenas de pendências
      // resolvia uma linha e deixava todas as outras iguais na fila — o ganho
      // que a regra existe pra dar simplesmente não aparecia.
      // Aplicar direto está fora de questão (reclassificar lançamento antigo
      // exige preview explícito), então abre a conferência com o resto.
      const preview = categoryRuleApplicationService.previewApplyActiveRulesToEligibleTransactions();
      const pendingForRule = preview.matches.length;

      if (pendingForRule > 0) {
        setRuleApplicationPreview(preview);
        setSelectedRuleApplicationIds(preview.matches.map((match) => match.transactionId));
        setMessage(
          `Regra criada e aplicada: ${rule.category}. Ela também combina com ${pendingForRule} lançamento(s) — confira abaixo antes de aplicar.`,
        );
      } else {
        setMessage(`Regra criada e aplicada: ${rule.category}.`);
      }
    } catch (ruleError) {
      setRuleMessage(ruleError instanceof Error ? ruleError.message : 'Não foi possível criar e aplicar a regra.');
    }
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Revisão" tabs={getFinanceTabs(pendingReviewCount)} />

      {/* Aviso sobre pendências */}
      <p style={{ fontSize: '12px', color: 'var(--hub-warning)', marginBottom: '20px', lineHeight: 1.6 }}>
        Pendências podem alterar seus números. Conferências opcionais não entram no resultado real.
      </p>

      {allTransactions.length === 0 ? (
        <EmptyFinanceState
          title="Nenhuma transação local para revisar."
          description="Importe um CSV para criar pendências e movimentos sensíveis."
        />
      ) : (
        <>
          {/* Painel de controles */}
          <Card className="mb-5">
            {/* Stats inline */}
            <div className="flex flex-wrap items-end gap-8" style={{ marginBottom: '20px' }}>
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
                  Revisão necessária
                </p>
                <p className="tabular-nums" style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.02em', color: requiredTransactions.length > 0 ? 'var(--hub-warning)' : 'var(--hub-text)' }}>
                  {requiredTransactions.length}
                </p>
              </div>
              <div style={{ width: '1px', background: 'var(--hub-border)', height: '36px' }} />
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
                  Opcional
                </p>
                <p className="tabular-nums" style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
                  {optionalTransactions.length}
                </p>
              </div>
            </div>

            {/* Busca + mês */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3" style={{ marginBottom: '16px' }}>
              <input
                style={{ minWidth: '200px', flex: '1 1 200px' }}
                placeholder="Buscar por descrição…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <DateField
                type="month"
                value={selectedMonth ?? ''}
                onChange={changeSelectedMonth}
                ariaLabel="Mês de revisão"
              >
                <span className="text-[12px] font-medium uppercase tracking-[0.1em] transition-opacity hover:opacity-70" style={{ color: 'var(--hub-muted)' }}>
                  {selectedMonth ? formatMonthLabel(selectedMonth) : 'todos os meses'}
                </span>
              </DateField>
              {selectedMonth ? (
                <button
                  style={{ fontSize: '11px', color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="transition-opacity hover:opacity-60 whitespace-nowrap"
                  type="button"
                  onClick={() => changeSelectedMonth('')}
                >
                  todos os meses ×
                </button>
              ) : null}
            </div>

            {pendingOutsideSelectedMonth > 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--hub-warning)', marginBottom: '12px', lineHeight: 1.6 }}>
                {pendingOutsideSelectedMonth} pendência{pendingOutsideSelectedMonth === 1 ? '' : 's'} fora deste mês.
              </p>
            ) : null}

            {/* Filtros de tipo */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5" style={{ marginBottom: '20px' }}>
              {filters.map((option) => {
                const isActive = filter === option.id;
                const count = filterCounts[option.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="border-0 outline-none bg-transparent cursor-pointer"
                    style={{
                      fontSize: '11px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                      paddingBottom: '3px',
                      borderBottom: isActive ? '1px solid color-mix(in srgb, var(--hub-accent) 55%, transparent)' : '1px solid transparent',
                      transition: 'color 0.15s, border-color 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      setFilter(option.id);
                      setActiveId(null);
                      setMessage('');
                    }}
                  >
                    {option.label}{count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>

            {/* Aplicar regras */}
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--hub-text-body)', fontWeight: 500 }}>Aplicar regras manuais</p>
                <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
                  Busca pendências que batem com suas regras. Nada é alterado sem confirmação.
                </p>
              </div>
              <button
                style={{ fontSize: '13px', fontWeight: 500, color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                className="transition-opacity hover:opacity-70"
                type="button"
                onClick={previewRuleApplication}
              >
                Aplicar regras ativas →
              </button>
            </div>
          </Card>

          {/* Preview de aplicação de regras */}
          {ruleApplicationPreview ? (
            <Card className="mb-5">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" style={{ marginBottom: '20px' }}>
                <div>
                  <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>Preview de aplicação de regras</p>
                  <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', lineHeight: 1.6 }}>
                    Nenhuma alteração foi feita ainda. Confirme os lançamentos que devem receber a regra.
                  </p>
                </div>
                <div className="flex flex-wrap gap-6">
                  <InlineStat label="Analisadas" value={ruleApplicationPreview.totalCandidates} />
                  <InlineStat label="Alterações" value={ruleApplicationPreview.totalMatches} tone="warning" />
                  <InlineStat label="Protegidas" value={ruleApplicationPreview.totalSkipped} />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <RuleMatchGroup
                  emptyText="Nenhuma pendência com regra explícita foi encontrada."
                  matches={ruleApplicationPreview.matches.filter((match) => match.matchOrigin === 'required_review')}
                  selectedIds={selectedRuleApplicationIds}
                  title="Pendências que serão corrigidas"
                  onToggle={toggleRuleApplicationSelection}
                />

                <RuleMatchGroup
                  emptyText="Nenhuma classificação automática elegível bateu com regra explícita."
                  matches={ruleApplicationPreview.matches.filter((match) => match.matchOrigin !== 'required_review')}
                  selectedIds={selectedRuleApplicationIds}
                  title="Classificações automáticas que serão sobrescritas"
                  onToggle={toggleRuleApplicationSelection}
                />

                {ruleApplicationPreview.matches.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', lineHeight: 1.6 }}>
                    Nenhuma regra ativa com tipo explícito combinou com os lançamentos elegíveis.
                  </p>
                ) : null}

                {ruleApplicationPreview.skipped.length > 0 ? (
                  <details style={{ paddingTop: '12px', borderTop: '1px solid var(--hub-border)' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--hub-subtle)', userSelect: 'none', marginBottom: '10px' }}>
                      Ver ignorados por segurança ({ruleApplicationPreview.skipped.length})
                    </summary>
                    <div className="grid gap-0">
                      {ruleApplicationPreview.skipped.map((item, i, arr) => (
                        <article key={item.transactionId} style={{ paddingBottom: '12px', marginBottom: i === arr.length - 1 ? 0 : '12px', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                          <strong className="block text-sm" style={{ fontWeight: 500, color: 'var(--hub-text)' }}>{item.description}</strong>
                          <span className="mt-0.5 block text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                            {item.category} / {formatTransactionKind(item.kind)}
                          </span>
                          <span className="block text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{item.reason}</span>
                        </article>
                      ))}
                    </div>
                  </details>
                ) : null}

                <div className="flex items-center gap-5">
                  <button
                    className="text-sm font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    disabled={selectedRuleApplicationIds.length === 0}
                    type="button"
                    onClick={confirmRuleApplication}
                  >
                    Confirmar aplicação
                  </button>
                  <button
                    className="text-xs transition-opacity hover:opacity-60"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                    type="button"
                    onClick={cancelRuleApplication}
                  >
                    cancelar
                  </button>
                </div>
              </div>
            </Card>
          ) : null}

          {message ? (
            <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '16px' }}>{message}</p>
          ) : null}

          {!activeTransaction || !draft ? (
            <EmptyFinanceState
              title={filter === 'required'
                ? 'Nenhuma pendência obrigatória neste recorte.'
                : filter === 'neutral'
                  ? 'Nenhuma conferência opcional neste recorte.'
                  : 'Nenhum item neste filtro.'}
              description="Troque o filtro ou volte quando novas pendências forem importadas."
            />
          ) : (
            <>
              {/* Card de revisão da transação ativa */}
              <Card className="mb-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span style={{ fontSize: '11px', color: transactionStatusColor(activeTransaction) }}>
                        {transactionStatus(activeTransaction)}
                      </span>
                      <span style={{ fontSize: '11px', color: categoryColor(activeTransaction.category) }}>
                        {activeTransaction.category}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                        Confiança {formatClassificationConfidence(activeTransaction.classificationConfidence)}
                      </span>
                      {isMatchedReimbursement(activeTransaction) ? (
                        <span style={{ fontSize: '11px', color: 'var(--hub-accent)' }}>Fora dos cálculos</span>
                      ) : null}
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--hub-text)' }}>{activeTransaction.description}</p>
                    <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', lineHeight: 1.5 }}>
                      {formatDate(activeTransaction.date)} · {formatTransactionKind(activeTransaction.kind)} · {formatTransactionMethod(activeTransaction.method)} · {activeTransaction.accountName ?? 'Sem conta'} · {activeTransaction.scope}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', lineHeight: 1.5 }}>
                      {activeTransaction.source}
                      {activeTransaction.institution ? ` · ${activeTransaction.institution}` : ''}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--hub-muted)', lineHeight: 1.6 }}>{activeTransaction.classificationReason}</p>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: isNeutralResult(activeTransaction) ? 'var(--hub-accent)' : 'var(--hub-positive)' }}>
                      {isNeutralResult(activeTransaction)
                        ? 'Não entra no resultado real.'
                        : 'Entra no resultado real conforme kind atual.'}
                    </p>
                    {isMatchedReimbursement(activeTransaction) ? (
                      <a
                        className="transition-opacity hover:opacity-70"
                        style={{ fontSize: '12px', fontWeight: 500, color: 'var(--hub-accent)' }}
                        href={withReimbursementsParams(activeTransaction.date.slice(0, 7))}
                      >
                        Ver em Reembolsos →
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <strong
                      className="tabular-nums"
                      style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.02em', color: activeTransaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}
                    >
                      {formatCurrency(activeTransaction.amount)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                      {activeTransaction.reviewedAt
                        ? 'Revisada'
                        : optionalIds.has(activeTransaction.id)
                        ? 'Conferência opcional'
                        : activeTransaction.needsReview
                          ? 'Pendente de revisão'
                          : 'Revisada'}
                    </span>
                  </div>
                </div>

                {/* Formulário de revisão */}
                <form className="mt-4 grid gap-5" style={{ paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }} onSubmit={saveAndNext}>
                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Categoria</span>
                      <Select
                        className="w-full cursor-pointer appearance-none"
                        value={draft.category}
                        onChange={(nextCategory) => {
                          setDraft({
                            ...draft,
                            category: nextCategory,
                            kind: inferKindFromCategory(nextCategory, draft.kind, activeTransaction.amount, activeTransaction.description),
                          });
                        }}
                      >
                        {categoryOptions.map((category) => (
                          <Select.Option key={category} value={category}>
                            {category}
                          </Select.Option>
                        ))}
                      </Select>
                    </label>
                    <label className="space-y-1.5">
                      <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Tipo</span>
                      <Select
                        className="w-full cursor-pointer appearance-none"
                        value={draft.kind}
                        onChange={(value) => setDraft({ ...draft, kind: value as TransactionKind })}
                      >
                        {kindOptions.map((option) => (
                          <Select.Option key={option} value={option}>
                            {formatTransactionKind(option)}
                          </Select.Option>
                        ))}
                      </Select>
                    </label>
                  </div>
                  <label className="space-y-1.5">
                    <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Notas</span>
                    <textarea
                      className="w-full leading-6 resize-none"
                      rows={2}
                      value={draft.notes}
                      onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                    />
                  </label>
                  {/* Parcelamento — só para card_purchase > R$200 */}
                  {draft.kind === 'card_purchase' && Math.abs(activeTransaction.amount) > 200 && (
                    <section style={{ paddingTop: '12px', borderTop: '1px solid var(--hub-border)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={draft.isInstallment}
                          className="accent-indigo-500"
                          onChange={(e) => setDraft({ ...draft, isInstallment: e.target.checked, installmentCount: '', installmentValue: '' })}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--hub-text-body)' }}>Compra parcelada</span>
                      </label>
                      {draft.isInstallment && (() => {
                        const n = parseInt(draft.installmentCount);
                        const autoValue = !isNaN(n) && n >= 2
                          ? (Math.abs(activeTransaction.amount) / n).toFixed(2)
                          : '';
                        return (
                          <div className="mt-3 grid grid-cols-2 gap-4" style={{ maxWidth: '300px' }}>
                            <label className="space-y-1.5">
                              <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--hub-subtle)' }}>
                                Parcelas
                              </span>
                              <input
                                type="number"
                                min="2"
                                max="60"
                                placeholder="ex: 12"
                                className="w-full"
                                style={{ color: 'var(--hub-text)' }}
                                value={draft.installmentCount}
                                onChange={(e) => setDraft({ ...draft, installmentCount: e.target.value })}
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--hub-subtle)' }}>
                                Vlr/parcela (R$)
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder={autoValue || 'auto'}
                                className="w-full"
                                style={{ color: 'var(--hub-text)' }}
                                value={draft.installmentValue}
                                onChange={(e) => setDraft({ ...draft, installmentValue: e.target.value })}
                              />
                            </label>
                          </div>
                        );
                      })()}
                    </section>
                  )}

                  <div className="flex flex-wrap items-center gap-5">
                    <button
                      className="text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="submit"
                    >
                      Salvar e próximo
                    </button>
                    <button
                      className="text-sm font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={markReviewed}
                    >
                      Marcar revisada
                    </button>
                    <button
                      className="text-xs transition-opacity hover:opacity-60"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={skip}
                    >
                      pular
                    </button>
                  </div>

                  {/* Criar regra */}
                  <section style={{ paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
                    <p style={{ fontSize: '13px', color: 'var(--hub-text-body)', fontWeight: 500 }}>Criar regra para lançamentos parecidos</p>
                    <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '3px', marginBottom: '12px' }}>
                      Novas importações usam a regra; transações antigas só mudam por ação explícita.
                    </p>
                    <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
                      <label className="space-y-1.5" style={{ flex: '1 1 160px', minWidth: '140px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Palavra-chave</span>
                        <input
                          className="w-full"
                          value={ruleKeyword}
                          onChange={(event) => setRuleKeyword(event.target.value)}
                        />
                      </label>
                      <button
                        className="text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'color-mix(in srgb, var(--hub-accent) 80%, transparent)', background: 'none', border: 'none', cursor: 'pointer', paddingBottom: '6px' }}
                        type="button"
                        onClick={createRuleForCurrentTransaction}
                      >
                        Criar regra
                      </button>
                      <button
                        className="text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', paddingBottom: '6px' }}
                        type="button"
                        onClick={createRuleAndApplyCurrentTransaction}
                      >
                        Criar e aplicar
                      </button>
                    </div>
                    {ruleMessage ? <p className="mt-2 text-sm leading-6" style={{ color: 'var(--hub-positive)' }}>{ruleMessage}</p> : null}
                  </section>
                </form>

                {/* Ações rápidas */}
                <section className="mt-4" style={{ paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hub-subtle)' }}>Ações rápidas</h4>
                  <div className="flex flex-wrap gap-2">
                    <QuickAction
                      label="Transferência interna"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.internalTransfer, kind: 'transfer', needsReview: false },
                          'Transferência interna confirmada.',
                        )
                      }
                    />
                    <QuickAction
                      label="Corrigir → Despesa"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.other, kind: 'expense', needsReview: false },
                          'Transação corrigida para despesa.',
                        )
                      }
                    />
                    <QuickAction
                      label="Corrigir → Renda"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.income, kind: 'income', needsReview: false },
                          'Transação corrigida para renda.',
                        )
                      }
                    />
                    <QuickAction
                      label="Manter despesa a revisar"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.expenseReview, kind: 'expense', needsReview: true },
                          'Despesa mantida para revisão posterior.',
                        )
                      }
                    />
                    <QuickAction
                      label="Manter entrada a revisar"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.incomeReview, kind: 'review', needsReview: true },
                          'Entrada mantida para revisão posterior.',
                        )
                      }
                    />
                    <QuickAction
                      label="Pagamento de fatura"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.cardPayment, kind: 'card_payment', needsReview: false },
                          'Pagamento de fatura confirmado.',
                        )
                      }
                    />
                    <QuickAction
                      label="Pagamento recebido"
                      onClick={() =>
                        runQuickAction(
                          { category: specialCategories.cardPaymentReceived, kind: 'card_payment_received', needsReview: false },
                          'Pagamento recebido confirmado.',
                        )
                      }
                    />
                  </div>
                </section>
              </Card>

              {/* Fila de transações */}
              <Card>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '12px' }}>
                  Fila atual
                  <span style={{ marginLeft: '8px', color: 'var(--hub-disabled)', fontWeight: 400, textTransform: 'none', letterSpacing: '0' }}>
                    ({filteredTransactions.length} item{filteredTransactions.length !== 1 ? 's' : ''})
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {filteredTransactions.slice(0, 12).map((transaction) => {
                    const isActiveTx = transaction.id === activeTransaction.id;
                    return (
                      <button
                        key={transaction.id}
                        className="max-w-full truncate text-left text-xs font-medium transition-opacity hover:opacity-80"
                        style={{
                          color: isActiveTx ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          paddingBottom: '3px',
                          borderBottom: isActiveTx ? '1px solid color-mix(in srgb, var(--hub-accent) 40%, transparent)' : '1px solid transparent',
                        }}
                        type="button"
                        onClick={() => {
                          setActiveId(transaction.id);
                          setMessage('');
                        }}
                      >
                        {transaction.description}
                      </button>
                    );
                  })}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function InlineStat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'warning' }) {
  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>{label}</p>
      <p className="tabular-nums" style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '-0.02em', color: tone === 'warning' && value > 0 ? 'var(--hub-warning)' : 'var(--hub-text)' }}>{value}</p>
    </div>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      className="text-xs font-medium transition-opacity hover:opacity-80"
      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function RuleMatchGroup({
  emptyText,
  matches,
  selectedIds,
  title,
  onToggle,
}: {
  emptyText: string;
  matches: RuleApplicationPreview['matches'];
  selectedIds: string[];
  title: string;
  onToggle(transactionId: string): void;
}) {
  return (
    <section className="grid gap-3">
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>{title}</p>
      {matches.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>{emptyText}</p>
      ) : (
        matches.map((match) => (
          <label
            key={match.transactionId}
            className="grid cursor-pointer gap-3 sm:grid-cols-[auto_minmax(0,1fr)] transition-opacity hover:opacity-80"
            style={{ paddingBottom: '12px', borderBottom: '1px solid var(--hub-border)' }}
          >
            <input
              checked={selectedIds.includes(match.transactionId)}
              className="mt-1 h-4 w-4 rounded accent-indigo-500"
              type="checkbox"
              onChange={() => onToggle(match.transactionId)}
            />
            <span className="grid gap-2">
              <span className="flex flex-wrap items-start justify-between gap-2">
                <strong style={{ fontSize: '13px', fontWeight: 500, color: 'var(--hub-text)' }}>{match.description}</strong>
                <strong className="tabular-nums" style={{ fontSize: '13px', fontWeight: 300, color: match.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}>
                  {formatCurrency(match.amount)}
                </strong>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--hub-subtle)', lineHeight: 1.5 }}>{formatDate(match.date)}</span>
              <span className="grid gap-1 sm:grid-cols-2" style={{ fontSize: '11px', color: 'var(--hub-muted)' }}>
                <span>{match.currentCategory} → <strong style={{ color: 'var(--hub-text)', fontWeight: 500 }}>{match.newCategory}</strong></span>
                <span>{formatTransactionKind(match.currentKind)} → <strong style={{ color: 'var(--hub-text)', fontWeight: 500 }}>{formatTransactionKind(match.newKind)}</strong></span>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--hub-accent)' }}>Regra: {match.matchedRuleKeyword}</span>
              <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>{match.reason}</span>
            </span>
          </label>
        ))
      )}
    </section>
  );
}
