import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select, Toast } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { EmptyFinanceState } from '../components/EmptyFinanceState';
import { ReimbursementsSection } from '../components/ReimbursementsSection';
import { CategorySpendingCard } from '../components/CategorySpendingCard';
import { MonthSelector } from '../components/MonthSelector';
import { KIND_OPTIONS, METHOD_OPTIONS, TransactionEditor } from '../components/TransactionEditor';
import { categoryService } from '../services/categoryService';
import { transactionService } from '../services/transactionService';
import { categoryRuleService } from '../services/categoryRuleService';
import { extractMerchant } from '../utils/financeText';
import { type FinanceScope, type TransactionKind, type TransactionMethod } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { isMatchedReimbursement, transactionMonthKey } from '../utils/financeCalculations';
import { isNeutralTransaction } from '../../../shared/finance/financeTotals.js';
import { formatCurrency, formatDate, formatTransactionKind, formatTransactionMethod } from '../utils/financeFormatters';
import { formatMonthLabel, getMonthKeyFromQuery, withMonthParam } from '../utils/financePeriod';

type ScopeFilter = FinanceScope;
/**
 * The line under the filters after any change: what happened, how to undo it,
 * and — after a one-tap category change — "lembrar" for that store.
 */
type Notice = {
  text: string;
  tone?: 'positive' | 'negative' | 'neutral';
  undo?: () => void;
  remember?: { transactionId: string; category: string; merchant: string; saved: boolean };
};

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryMonth = searchParams.get('month');
  const queryCategory = searchParams.get('category')?.trim() || null;
  const [transactions, setTransactions] = useState(() => transactionService.listTransactions());
  const month = getMonthKeyFromQuery(queryMonth);
  // Every filter lives in the URL: going to the Relatório and back (or sharing a
  // link) used to drop all of them but the month and the category.
  const search = searchParams.get('q') ?? '';
  const scope = (searchParams.get('scope') as ScopeFilter | null) ?? 'consolidado';
  const category = queryCategory ?? 'all';
  const kind = (searchParams.get('kind') as TransactionKind | null) ?? 'all';
  const method = (searchParams.get('method') as TransactionMethod | null) ?? 'all';
  const onlyReview = searchParams.get('pending') === '1';
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [narrowScreen] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const pendingReviewCount = transactionService.listCurrentMonthReviewTransactions().length;
  const view: 'list' | 'reembolsos' = searchParams.get('view') === 'reembolsos' ? 'reembolsos' : 'list';
  const hasCategoryFilter = category !== 'all';
  const hasExtraFilters = scope !== 'consolidado' || kind !== 'all' || method !== 'all' || onlyReview;
  const categoryOptions = useMemo(
    () => [...new Set([...categoryService.getAvailableCategories().map((item) => item.name), ...transactions.map((item) => item.category)])].sort(),
    [transactions],
  );
  const filterCategoryOptions = useMemo(
    () => [...new Set([...(category !== 'all' ? [category] : []), ...categoryOptions])].sort(),
    [category, categoryOptions],
  );

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');

    return transactions
      .filter((transaction) => {
        const textMatch =
          !normalizedSearch ||
          `${transaction.description} ${transaction.originalDescription ?? ''}`
            .toLocaleLowerCase('pt-BR')
            .includes(normalizedSearch);
        // A search looks in every month: "quando foi que paguei o IPVA?" rarely
        // has the answer in the month on screen.
        const monthMatch = Boolean(normalizedSearch) || transactionMonthKey(transaction) === month;
        const scopeMatch = scope === 'consolidado' || transaction.scope === scope;
        const categoryMatch = category === 'all' || transaction.category === category;
        const kindMatch = kind === 'all' || transaction.kind === kind;
        const methodMatch = method === 'all' || transaction.method === method;
        const reviewMatch = !onlyReview || transaction.needsReview;

        return textMatch && monthMatch && scopeMatch && categoryMatch && kindMatch && methodMatch && reviewMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [category, kind, method, month, onlyReview, scope, search, transactions]);

  // Agrupa transações por data para o layout tipo extrato bancário
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, { transactions: Transaction[]; total: number }>();
    for (const t of filteredTransactions) {
      const dateKey = t.date;
      if (!groups.has(dateKey)) groups.set(dateKey, { transactions: [], total: 0 });
      const g = groups.get(dateKey)!;
      g.transactions.push(t);
      // The day's total is what was spent/received — paying the bill, a
      // transfer or an investment only moves money and made the day look red.
      if (!isNeutralTransaction(t) && !isMatchedReimbursement(t)) g.total += t.amount;
    }
    return Array.from(groups.entries()).map(([date, data]) => ({ date, ...data }));
  }, [filteredTransactions]);

  function refreshTransactions() {
    setTransactions(transactionService.listTransactions());
  }

  function setParam(key: string, value: string | null, replace = false) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace });
  }

  function startEditing(transaction: Transaction) {
    setCreating(false);
    setEditingId(transaction.id);
  }

  function stopEditing() {
    setEditingId(null);
  }

  function handleEditorDone(result: { text: string; undo?: () => void; date?: string }) {
    refreshTransactions();
    // A line saved in another month would just vanish from this one: follow it.
    if (result.date && !search.trim() && transactionMonthKey({ date: result.date }) !== month) {
      setParam('month', transactionMonthKey({ date: result.date }));
    }
    setEditingId(null);
    setCreating(false);
    setNotice({
      text: result.text,
      tone: 'positive',
      undo: result.undo
        ? () => {
            result.undo?.();
            refreshTransactions();
            setNotice({ text: 'Desfeito.', tone: 'neutral' });
          }
        : undefined,
    });
  }

  /** One tap on the category in the row: saves right away, like an answer in Revisar. */
  function quickRecategorize(transaction: Transaction, nextCategory: string) {
    if (nextCategory === transaction.category) return;
    transactionService.reviewTransaction(transaction.id, {
      category: nextCategory,
      needsReview: false,
      reviewedBy: 'transactions_page',
    });
    refreshTransactions();
    setNotice({
      text: `${transaction.description} → ${nextCategory}`,
      tone: 'neutral',
      undo: () => {
        transactionService.replaceTransactions(
          transactionService.listTransactions().map((item) => (item.id === transaction.id ? transaction : item)),
        );
        refreshTransactions();
        setNotice({ text: 'Troca desfeita.', tone: 'neutral' });
      },
      remember: { transactionId: transaction.id, category: nextCategory, merchant: extractMerchant(transaction.description).trim(), saved: false },
    });
  }

  function rememberQuickChange() {
    const remember = notice?.remember;
    if (!remember) return;
    const changed = transactionService.getTransactionById(remember.transactionId);
    if (!changed) return;
    try {
      categoryRuleService.createRuleFromTransaction(changed, remember.category, remember.merchant, changed.kind);
      setNotice({ text: `${changed.description} → ${remember.category} · as próximas de "${remember.merchant}" já entram assim`, tone: 'neutral' });
    } catch (ruleError) {
      setNotice({ text: ruleError instanceof Error ? ruleError.message : 'Não foi possível criar a regra.', tone: 'negative' });
    }
  }

  function handleMarkReviewed(transaction: Transaction) {
    transactionService.markTransactionReviewed(transaction.id);
    refreshTransactions();
    setNotice({ text: 'Transação marcada como revisada.', tone: 'positive' });
  }

  function changeMonth(value: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('month', getMonthKeyFromQuery(value));
    setSearchParams(nextSearchParams);
  }

  function changeCategory(value: string) {
    setParam('category', value && value !== 'all' ? value : null);
  }

  function setView(next: 'list' | 'reembolsos') {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (next === 'reembolsos') {
      nextSearchParams.set('view', 'reembolsos');
    } else {
      nextSearchParams.delete('view');
    }
    setSearchParams(nextSearchParams);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of ['q', 'scope', 'kind', 'method', 'pending', 'category']) next.delete(key);
    setSearchParams(next);
  }

  function emptyFilterDescription() {
    if (search.trim()) {
      return `Nenhum lançamento com "${search.trim()}" em nenhum mês.`;
    }

    if (hasCategoryFilter) {
      return `Nada em ${category} em ${formatMonthLabel(month)}.`;
    }

    return `Nada encontrado em ${formatMonthLabel(month)} com esses filtros.`;
  }

  return (
    <div>
      <ModuleHeader
        eyebrow="Módulo · Financeiro"
        title="Gastos"
        tabs={getFinanceTabs(pendingReviewCount)}
        right={<MonthSelector value={month} onChange={changeMonth} />}
      />

      {/* Sub-abas Transações / Reembolsos: o mesmo traço sublinhado das abas do módulo */}
      <div className="flex items-center gap-1" role="tablist" style={{ marginBottom: '20px', borderBottom: '1px solid var(--hub-border)' }}>
        {([['list', 'Transações'], ['reembolsos', 'Reembolsos']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`hub-tab${view === id ? ' active' : ''}`}
            style={{ cursor: 'pointer', marginBottom: '-1px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'reembolsos' ? (
        <ReimbursementsSection month={month} />
      ) : transactions.length === 0 ? (
        <>
          <EmptyFinanceState
            title="Nenhuma transação salva."
            description="Importe o extrato do banco (CSV) ou lance um gasto à mão."
            action={{ label: 'Importar extrato', to: '/financeiro/configurar/importar' }}
          />
          <Card className="mt-5">
            {creating ? (
              <TransactionEditor transaction={null} categoryOptions={categoryOptions} onDone={handleEditorDone} onCancel={() => setCreating(false)} />
            ) : (
              <button
                type="button"
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => setCreating(true)}
              >
                + Lançar à mão
              </button>
            )}
          </Card>
          {notice ? <Toast text={notice.text} tone={notice.tone} onClose={() => setNotice(null)} actions={notice.undo ? [{ label: 'Desfazer', onClick: notice.undo }] : []} /> : null}
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
          {/* Busca + filtros recolhidos: o mês vem do seletor e a categoria do "Onde foi" */}
          <Card className="mb-5">
            <input
              className="w-full pb-2"
              style={{ display: 'block' }}
              placeholder="Buscar por descrição…"
              value={search}
              // replace: typing must not leave one history entry per letter.
              onChange={(event) => setParam('q', event.target.value || null, true)}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ marginTop: '12px' }}>
              {hasCategoryFilter ? <FilterChip label={category} onRemove={() => changeCategory('all')} /> : null}
              <button
                type="button"
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: hasExtraFilters ? 'var(--hub-accent)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'menos filtros' : hasExtraFilters ? 'filtros ativos' : 'mais filtros'}
              </button>
              {hasCategoryFilter || hasExtraFilters || search ? (
                <button type="button" className="text-xs transition-opacity hover:opacity-60" style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={clearFilters}>
                  limpar
                </button>
              ) : null}
              <button
                type="button"
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                aria-expanded={creating}
                onClick={() => { setEditingId(null); setCreating(!creating); }}
              >
                + lançamento
              </button>
              <span className="ml-auto tabular-nums" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                {filteredTransactions.length} lançamento{filteredTransactions.length === 1 ? '' : 's'}
                {search.trim() ? ' · todos os meses' : ''}
              </span>
            </div>
            {showFilters ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--hub-border)' }}>
                <FilterSelectInline label="Escopo" value={scope} onChange={(v) => setParam('scope', v === 'consolidado' ? null : v)}>
                  <Select.Option value="consolidado">todos</Select.Option>
                  <Select.Option value="pessoal">pessoal</Select.Option>
                  <Select.Option value="empresa">empresa</Select.Option>
                </FilterSelectInline>
                <FilterSelectInline label="Tipo" value={kind} onChange={(v) => setParam('kind', v === 'all' ? null : v)}>
                  <Select.Option value="all">todos os tipos</Select.Option>
                  {KIND_OPTIONS.map((option) => (
                    <Select.Option key={option} value={option}>{formatTransactionKind(option)}</Select.Option>
                  ))}
                </FilterSelectInline>
                <FilterSelectInline label="Método de pagamento" value={method} onChange={(v) => setParam('method', v === 'all' ? null : v)}>
                  <Select.Option value="all">todos os métodos</Select.Option>
                  {METHOD_OPTIONS.map((option) => (
                    <Select.Option key={option} value={option}>{formatTransactionMethod(option)}</Select.Option>
                  ))}
                </FilterSelectInline>
                <label className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-70" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
                  <input
                    type="checkbox"
                    checked={onlyReview}
                    onChange={(event) => setParam('pending', event.target.checked ? '1' : null)}
                  />
                  só pendentes
                </label>
              </div>
            ) : null}
          </Card>

          {creating ? (
            <Card className="mb-5">
              <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
                Novo lançamento
              </p>
              <TransactionEditor transaction={null} categoryOptions={categoryOptions} onDone={handleEditorDone} onCancel={() => setCreating(false)} />
            </Card>
          ) : null}

          {notice ? (
            <Toast
              text={notice.text}
              tone={notice.tone}
              onClose={() => setNotice(null)}
              actions={[
                ...(notice.remember?.merchant ? [{ label: `Lembrar para "${notice.remember.merchant}"`, onClick: rememberQuickChange, primary: true }] : []),
                ...(notice.undo ? [{ label: 'Desfazer', onClick: notice.undo }] : []),
              ]}
            />
          ) : null}

          {filteredTransactions.length === 0 ? (
            <EmptyFinanceState title="Nenhum lançamento." description={emptyFilterDescription()} />
          ) : (
            <Card>
              <div className="space-y-6">
                {groupedByDate.map(({ date, transactions: dayTxns, total }, groupIdx) => (
                  <div key={date} style={{ paddingBottom: groupIdx === groupedByDate.length - 1 ? 0 : '24px', borderBottom: groupIdx === groupedByDate.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                    {/* Cabeçalho do dia — tipográfico, sem container */}
                    <div className="mb-1 flex items-baseline justify-between">
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                        {dayLabel(date)}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ fontSize: '11px', fontWeight: 500, color: total < 0 ? 'var(--hub-negative)' : total > 0 ? 'var(--hub-positive)' : 'var(--hub-disabled)' }}
                      >
                        {formatCurrency(total)}
                      </span>
                    </div>

                    {/* Linhas sem container externo */}
                    <div>
                      {dayTxns.map((transaction, idx) => {
                        const isEditing = editingId === transaction.id;
                        const matchedReimbursement = isMatchedReimbursement(transaction);
                        const isLast = idx === dayTxns.length - 1;

                        return (
                          <article
                            key={transaction.id}
                            style={{ borderBottom: !isLast ? '1px solid var(--hub-border)' : 'none' }}
                          >
                            {/* Linha da transação */}
                            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-3">
                              {/* Dot indicador */}
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: transaction.needsReview ? 'var(--hub-warning)' : transaction.amount < 0 ? 'color-mix(in srgb, var(--hub-negative) 45%, transparent)' : 'color-mix(in srgb, var(--hub-positive) 45%, transparent)' }}
                              />

                              {/* Descrição + meta */}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>
                                  {transaction.description}
                                </p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                                  <Select
                                    variant="inline"
                                    value={transaction.category}
                                    onChange={(next) => quickRecategorize(transaction, next)}
                                    aria-label={`Categoria de ${transaction.description}`}
                                  >
                                    {[...new Set([transaction.category, ...categoryOptions])].map((option) => (
                                      <Select.Option key={option} value={option}>{option}</Select.Option>
                                    ))}
                                  </Select>
                                  {transaction.kind !== 'expense' && transaction.kind !== 'income' ? (
                                    <><span>·</span><span>{formatTransactionKind(transaction.kind)}</span></>
                                  ) : null}
                                  {transaction.method === 'credito' && transaction.kind !== 'card_purchase' ? (
                                    <><span>·</span><span>{formatTransactionMethod(transaction.method)}</span></>
                                  ) : null}
                                  {matchedReimbursement ? (
                                    <><span>·</span><span style={{ color: 'var(--hub-accent)' }}>Reembolso pareado</span></>
                                  ) : null}
                                </p>
                              </div>

                              {/* Valor */}
                              <strong
                                className="shrink-0 text-sm tabular-nums"
                                style={{
                                  fontWeight: 400,
                                  color: isNeutralTransaction(transaction) || matchedReimbursement
                                    ? 'var(--hub-muted)'
                                    : transaction.amount < 0
                                      ? 'var(--hub-negative)'
                                      : 'var(--hub-positive)',
                                }}
                              >
                                {formatCurrency(transaction.amount)}
                              </strong>

                              {/* Ações */}
                              <div className="-my-2 flex shrink-0">
                                {transaction.needsReview ? (
                                  <button
                                    type="button"
                                    title="Marcar como revisada"
                                    aria-label={`Marcar ${transaction.description} como revisada`}
                                    className="flex h-9 w-9 items-center justify-center text-sm font-medium transition-opacity hover:opacity-70"
                                    style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    onClick={() => handleMarkReviewed(transaction)}
                                  >
                                    ✓
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="flex h-9 min-w-9 items-center justify-center text-sm transition-opacity hover:opacity-70"
                                  style={{ color: isEditing ? 'var(--hub-accent)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                                  aria-label={isEditing ? 'Fechar edição' : `Editar ${transaction.description}`}
                                  title={isEditing ? 'Fechar edição' : 'Editar, dividir ou excluir'}
                                  onClick={() => (isEditing ? stopEditing() : startEditing(transaction))}
                                >
                                  {isEditing ? '✕' : '···'}
                                </button>
                              </div>
                            </div>

                            {/* Notas / mensagens especiais */}
                            {transaction.notes && !isEditing ? (
                              <p className="text-xs" style={{ color: 'var(--hub-subtle)', padding: '0 2px 8px', marginTop: '-6px' }}>{transaction.notes}</p>
                            ) : null}

                            {/* Formulário de edição expandido */}
                            {isEditing ? (
                              <TransactionEditor transaction={transaction} categoryOptions={categoryOptions} onDone={handleEditorDone} onCancel={stopEditing} />
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          </div>

          {/* No celular "Onde foi" vem antes da lista; no computador fica ao lado. */}
          <div className="order-first flex min-w-0 flex-col gap-5 lg:order-none">
            {/* A search spans every month: the month's breakdown beside it would mislead. */}
            {search.trim() ? null : (
            <CategorySpendingCard
              month={month}
              // On a phone it comes before the list: four rows, not eight, before the first entry.
              limit={narrowScreen ? 4 : 8}
              selected={hasCategoryFilter ? category : null}
              onSelect={(next) => changeCategory(next === category ? 'all' : next)}
            />
            )}
            <Link
              to={withMonthParam('/financeiro/gastos/relatorio', month)}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)' }}
            >
              Relatório e análise do mês →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const DAY_MS = 86_400_000;

/** "Hoje", "Ontem", or the date — the feed reads like a bank statement. */
function dayLabel(date: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((today - new Date(`${date}T00:00:00`).getTime()) / DAY_MS);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return formatDate(date);
}

function FilterChip({ label, onRemove }: { label: string; onRemove(): void }) {
  return (
    <button
      aria-label={`Remover filtro ${label}`}
      className="inline-flex h-7 max-w-full items-center gap-1.5 transition-opacity hover:opacity-70"
      style={{ fontSize: '11px', color: 'var(--hub-accent)' }}
      type="button"
      onClick={onRemove}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden="true" style={{ color: 'var(--hub-subtle)', lineHeight: 1 }}>×</span>
    </button>
  );
}

// Select compacto para a linha de filtros (sem label stack)
function FilterSelectInline({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange(value: string): void;
  value: string;
}) {
  return (
    <Select
      aria-label={label}
      className="bg-transparent text-xs outline-none cursor-pointer appearance-none transition-opacity hover:opacity-70"
      value={value}
      onChange={onChange}
    >
      {children}
    </Select>
  );
}
