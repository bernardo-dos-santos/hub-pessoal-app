import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select, Toast } from '../../../shared/ui';
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
import { isMatchedReimbursement, isRealExpense, isRealIncome, transactionMonthKey } from '../utils/financeCalculations';
import { parseMoneyText } from '../utils/moneyParsing';
import {
  formatClassificationConfidence,
  formatCurrency,
  formatDate,
  formatTransactionKind,
  formatTransactionMethod,
} from '../utils/financeFormatters';
import { formatMonthLabel, getCurrentMonthKey, isValidMonthKey, withReimbursementsParams } from '../utils/financePeriod';
import { extractMerchant, isGenericMerchant } from '../utils/financeText';
import { MonthSelector } from '../components/MonthSelector';
import { ImportReviewMonths } from '../components/ImportReviewMonths';
import { ReviewQuickCard } from '../components/ReviewQuickCard';
import { suggestReviewCategories } from '../services/reviewSuggestionService';

const ALL_MONTHS = 'all';

/**
 * Four questions, not nine: what needs me, what may, what the app wasn't sure of,
 * what I already did. "Entrada/Despesa a revisar" were slices of the first, and
 * transfers/bill payments by kind are what Gastos' filters are for.
 */
type ReviewFilter = 'required' | 'neutral' | 'low_confidence' | 'reviewed';

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
  { id: 'required', label: 'Precisa de você' },
  { id: 'neutral', label: 'Opcional' },
  { id: 'low_confidence', label: 'Incertos' },
  { id: 'reviewed', label: 'Já revisados' },
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
    ? 'var(--hub-accent)'
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
  // The queue is the month's: October's pending items don't sit in November's
  // list. `?month=all` is the explicit "everything" view.
  const selectedMonth = monthParam === ALL_MONTHS ? null : isValidMonthKey(monthParam) ? monthParam : getCurrentMonthKey();
  const [allTransactions, setAllTransactions] = useState(() => transactionService.listTransactions());
  const [requiredTransactions, setRequiredTransactions] = useState(() => transactionService.listRequiredReviewTransactions());
  const [optionalTransactions, setOptionalTransactions] = useState(() => transactionService.listOptionalCheckTransactions());
  const [reviewableTransactions, setReviewableTransactions] = useState(() => transactionService.listReviewableTransactions());
  const otherPendingMonths = [...new Set(requiredTransactions.map(transactionMonthKey))]
    .filter((month) => month !== selectedMonth)
    .sort();
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
  // The one-tap queue is the default; filters, rules and the full form are the detailed mode.
  const [detailed, setDetailed] = useState(false);
  const [rememberAnswer, setRememberAnswer] = useState(true);
  // The last quick answer, to put back: the items it touched and the rules before it.
  const [undoSnapshot, setUndoSnapshot] = useState<{ transactions: Transaction[]; rules: ReturnType<typeof categoryRuleService.listCategoryRules> } | null>(null);
  // The badge counts the current financial month only, like every other finance tab.
  const pendingReviewCount = useMemo(() => {
    const currentMonth = getCurrentMonthKey();
    return requiredTransactions.filter((transaction) => transactionMonthKey(transaction) === currentMonth).length;
  }, [requiredTransactions]);

  const optionalIds = useMemo(() => new Set(optionalTransactions.map((transaction) => transaction.id)), [optionalTransactions]);

  const inSelectedMonth = useMemo(
    () => (transaction: Transaction) => !selectedMonth || transactionMonthKey(transaction) === selectedMonth,
    [selectedMonth],
  );
  const monthRequired = useMemo(() => requiredTransactions.filter(inSelectedMonth), [inSelectedMonth, requiredTransactions]);
  const monthOptional = useMemo(() => optionalTransactions.filter(inSelectedMonth), [inSelectedMonth, optionalTransactions]);

  // Contagem por filtro para exibir nos botões — do mês selecionado
  const filterCounts = useMemo(() => {
    const base = (pred: (t: typeof allTransactions[0]) => boolean) =>
      reviewableTransactions.filter((t) => inSelectedMonth(t) && pred(t)).length;
    return {
      required: monthRequired.length,
      neutral:        monthOptional.length,
      low_confidence: base((t) => t.classificationConfidence === 'low'),
      reviewed:       allTransactions.filter((t) => inSelectedMonth(t) && Boolean(t.reviewedAt)).length,
    } as Record<string, number>;
  }, [allTransactions, inSelectedMonth, monthOptional, monthRequired, reviewableTransactions]);
  const categoryOptions = useMemo(
    () => [...new Set([...categoryService.getAvailableCategories().map((category) => category.name), ...allTransactions.map((item) => item.category)])].sort(),
    [allTransactions],
  );

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

      if (!inSelectedMonth(transaction)) {
        return false;
      }

      if (filter === 'neutral') {
        return optionalIds.has(transaction.id);
      }

      if (filter === 'low_confidence') {
        return transaction.classificationConfidence === 'low';
      }

      return true;
    });
  }, [allTransactions, filter, inSelectedMonth, optionalIds, requiredTransactions, reviewableTransactions, search]);

  const activeTransaction =
    filteredTransactions.find((transaction) => transaction.id === activeId) ?? filteredTransactions[0] ?? null;

  useEffect(() => {
    setDraft(activeTransaction ? createDraft(activeTransaction) : null);
    const merchant = activeTransaction ? extractMerchant(activeTransaction.description) : '';
    setRuleKeyword(merchant);
    setRuleMessage('');
    // "Pix enviado" or "Transferência" as a rule would catch every Pix: remembering
    // starts off for those, on for a real store name.
    setRememberAnswer(!isGenericMerchant(merchant));
  }, [activeTransaction?.id]);

  function refreshReviewData(nextActiveId?: string | null) {
    // Any other change ends the chance to undo the last quick answer.
    setUndoSnapshot(null);
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
    const parsedValue = draft.installmentValue.trim() !== '' ? parseMoneyText(draft.installmentValue) ?? undefined : undefined;
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
    setSelectedRuleApplicationIds(preview.matches.filter((match) => match.matchOrigin === 'required_review').map((match) => match.transactionId));
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

    nextSearchParams.set('month', isValidMonthKey(value) ? value : ALL_MONTHS);

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
        setSelectedRuleApplicationIds(preview.matches.filter((match) => match.matchOrigin === 'required_review').map((match) => match.transactionId));
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

  function openDetailed() {
    setDetailed(true);
    setMessage('');
  }

  function openQuick() {
    setDetailed(false);
    setFilter('required');
    setSearch('');
    setActiveId(null);
    setMessage('');
  }

  /**
   * One-tap answer: review the item and, with "Lembrar para as próximas",
   * turn the answer into a rule and resolve the other *pending* items it
   * matches. Pending ones only — an item the classifier already decided is
   * still reclassified only through the explicit preview in detailed mode.
   */
  function resolveQuick(category: string, kind: TransactionKind) {
    if (!activeTransaction) return;

    const nextId = nextIdAfter(activeTransaction.id);
    const rulesBefore = categoryRuleService.listCategoryRules();
    const touched: Transaction[] = [activeTransaction];
    transactionService.reviewTransaction(activeTransaction.id, {
      category,
      kind,
      needsReview: false,
      reviewedBy: 'quick_action',
    });

    let alsoResolved = 0;
    let ruleNote = '';
    if (rememberAnswer) {
      try {
        const rule = categoryRuleService.createRuleFromTransaction(activeTransaction, category, undefined, kind);
        const sameRuleIds = categoryRuleApplicationService
          .previewApplyActiveRulesToEligibleTransactions()
          .matches.filter((match) => match.matchedRuleId === rule.id && match.matchOrigin === 'required_review')
          .map((match) => match.transactionId)
          // Only the month on screen: the answer shouldn't quietly rewrite other months.
          .filter((id) => {
            const pending = requiredTransactions.find((transaction) => transaction.id === id);
            return Boolean(pending && inSelectedMonth(pending));
          });
        for (const id of sameRuleIds) {
          const before = transactionService.getTransactionById(id);
          if (before) touched.push(before);
        }
        if (sameRuleIds.length > 0) {
          alsoResolved = categoryRuleApplicationService.applyActiveRulesToEligibleTransactions(sameRuleIds).updatedCount;
        }
      } catch (ruleError) {
        ruleNote = ruleError instanceof Error ? ` (regra não criada: ${ruleError.message})` : '';
      }
    }

    refreshReviewData(nextId);
    setUndoSnapshot({ transactions: touched, rules: rulesBefore });
    setMessage(
      `${activeTransaction.description} → ${category}`
        + (alsoResolved > 0 ? ` · e mais ${alsoResolved} parecida${alsoResolved === 1 ? '' : 's'}` : '')
        + ruleNote,
    );
  }

  function undoLastAnswer() {
    if (!undoSnapshot) return;
    const previous = new Map(undoSnapshot.transactions.map((transaction) => [transaction.id, transaction]));
    transactionService.replaceTransactions(
      transactionService.listTransactions().map((transaction) => previous.get(transaction.id) ?? transaction),
    );
    categoryRuleService.restoreCategoryRules(undoSnapshot.rules);
    const firstId = undoSnapshot.transactions[0]?.id;
    setUndoSnapshot(null);
    refreshReviewData(firstId);
    setMessage('Resposta desfeita.');
  }

  const quickSuggestions = useMemo(
    () => (activeTransaction ? suggestReviewCategories(activeTransaction, allTransactions, categoryService.getAvailableCategories()) : []),
    [activeTransaction, allTransactions],
  );

  const monthPicker = selectedMonth ? (
    <>
      <MonthSelector size="sm" value={selectedMonth} onChange={changeSelectedMonth} />
      <button
        style={{ fontSize: '11px', color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        className="transition-opacity hover:opacity-60 whitespace-nowrap"
        type="button"
        onClick={() => changeSelectedMonth(ALL_MONTHS)}
      >
        ver todos os meses
      </button>
    </>
  ) : (
    <button
      style={{ fontSize: '12px', color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
      className="font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
      type="button"
      onClick={() => changeSelectedMonth(getCurrentMonthKey())}
    >
      todos os meses · voltar ao mês atual
    </button>
  );

  if (!detailed && allTransactions.length > 0) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Financeiro" title="Revisar" tabs={getFinanceTabs(pendingReviewCount)} />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" style={{ marginBottom: '12px' }}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{monthPicker}</div>
          <button
            type="button"
            onClick={openDetailed}
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            filtros, regras e edição detalhada →
          </button>
        </div>

        {message ? (
          <Toast
            text={message}
            onClose={() => setMessage('')}
            actions={undoSnapshot ? [{ label: 'Desfazer', onClick: undoLastAnswer }] : []}
          />
        ) : null}

        {activeTransaction ? (
          <ReviewQuickCard
            key={activeTransaction.id}
            transaction={activeTransaction}
            suggestions={quickSuggestions}
            categories={categoryOptions}
            remaining={filteredTransactions.length}
            remember={rememberAnswer}
            onRememberChange={setRememberAnswer}
            onCategory={(category) =>
              resolveQuick(category, inferKindFromCategory(category, activeTransaction.kind, activeTransaction.amount, activeTransaction.description))
            }
            onTransfer={() => resolveQuick(specialCategories.internalTransfer, 'transfer')}
            onSkip={skip}
            onDetails={openDetailed}
          />
        ) : (
          <>
            <EmptyFinanceState
              title={selectedMonth ? `Tudo revisado em ${formatMonthLabel(selectedMonth)}.` : 'Nada para revisar.'}
              description="Os números do mês já estão certos. Novas importações aparecem aqui quando precisarem de você."
            />
            {/* The queue stays on one month (by choice); a quiet pointer, not a nag, for the others. */}
            {selectedMonth ? <ImportReviewMonths months={otherPendingMonths} /> : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Revisar" tabs={getFinanceTabs(pendingReviewCount)} />

      <button
        type="button"
        onClick={openQuick}
        className="text-xs transition-opacity hover:opacity-60"
        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '12px', padding: 0 }}
      >
        ← voltar à fila rápida
      </button>

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
                <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
                  Revisão necessária
                </p>
                <p className="tabular-nums" style={{ fontSize: '22px', fontWeight: 400, letterSpacing: '-0.02em', color: monthRequired.length > 0 ? 'var(--hub-warning)' : 'var(--hub-text)' }}>
                  {monthRequired.length}
                </p>
              </div>
              <div style={{ width: '1px', background: 'var(--hub-border)', height: '36px' }} />
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
                  Opcional
                </p>
                <p className="tabular-nums" style={{ fontSize: '22px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
                  {monthOptional.length}
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
              {monthPicker}
            </div>

            {/* Filtros de tipo */}
            <div className="hub-scroll-strip flex gap-5 overflow-x-auto" style={{ marginBottom: '20px', borderBottom: '1px solid var(--hub-border)' }}>
              {filters.map((option) => {
                const isActive = filter === option.id;
                const count = filterCounts[option.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`hub-tab shrink-0 tabular-nums${isActive ? ' active' : ''}`}
                    aria-pressed={isActive}
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
                  <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>Preview de aplicação de regras</p>
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

          {message ? <Toast text={message} onClose={() => setMessage('')} /> : null}

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
                        href={withReimbursementsParams(transactionMonthKey(activeTransaction))}
                      >
                        Ver em Reembolsos →
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <strong
                      className="tabular-nums"
                      style={{ fontSize: '20px', fontWeight: 400, letterSpacing: '-0.02em', color: activeTransaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}
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
                      <span style={{ fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Categoria</span>
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
                      <span style={{ fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Tipo</span>
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
                    <span style={{ fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Notas</span>
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
                          onChange={(e) => setDraft({ ...draft, isInstallment: e.target.checked, installmentCount: '', installmentValue: '' })}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--hub-text-body)' }}>Compra parcelada</span>
                      </label>
                      {draft.isInstallment && (() => {
                        const n = parseInt(draft.installmentCount);
                        const autoValue = !isNaN(n) && n >= 2
                          ? (Math.abs(activeTransaction.amount) / n).toFixed(2).replace('.', ',')
                          : '';
                        return (
                          <div className="mt-3 grid grid-cols-2 gap-4" style={{ maxWidth: '300px' }}>
                            <label className="space-y-1.5">
                              <span style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--hub-subtle)' }}>
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
                              <span style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--hub-subtle)' }}>
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
                        <span style={{ fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Palavra-chave</span>
                        <input
                          className="w-full"
                          value={ruleKeyword}
                          onChange={(event) => setRuleKeyword(event.target.value)}
                        />
                      </label>
                      <button
                        className="text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', paddingBottom: '6px' }}
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
                <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '12px' }}>
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
      <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>{label}</p>
      <p className="tabular-nums" style={{ fontSize: '18px', fontWeight: 400, letterSpacing: '-0.02em', color: tone === 'warning' && value > 0 ? 'var(--hub-warning)' : 'var(--hub-text)' }}>{value}</p>
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
      <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>{title}</p>
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
              className="mt-1 h-4 w-4 rounded"
              type="checkbox"
              onChange={() => onToggle(match.transactionId)}
            />
            <span className="grid gap-2">
              <span className="flex flex-wrap items-start justify-between gap-2">
                <strong style={{ fontSize: '13px', fontWeight: 500, color: 'var(--hub-text)' }}>{match.description}</strong>
                <strong className="tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: match.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}>
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
