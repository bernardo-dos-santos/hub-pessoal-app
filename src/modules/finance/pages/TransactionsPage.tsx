import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { EmptyFinanceState } from '../components/EmptyFinanceState';
import { ReimbursementsSection } from '../components/ReimbursementsSection';
import { categoryService } from '../services/categoryService';
import { inferKindFromCategory } from '../services/transactionNormalizationService';
import { transactionService } from '../services/transactionService';
import { type FinanceScope, type TransactionKind, type TransactionMethod } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { isMatchedReimbursement } from '../utils/financeCalculations';
import { formatCurrency, formatDate, formatTransactionKind, formatTransactionMethod } from '../utils/financeFormatters';
import { formatMonthLabel, isValidMonthKey } from '../utils/financePeriod';

type ScopeFilter = FinanceScope | 'all';
type EditDraft = Pick<Transaction, 'category' | 'kind' | 'needsReview' | 'manualCategory'> & {
  notes: string;
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

// Eixo separado de kind (natureza do lançamento) — method é o instrumento de
// pagamento (débito/crédito/pix/etc), campo que existia no banco mas nunca
// aparecia em nenhuma tela.
const methodOptions: TransactionMethod[] = [
  'pix',
  'debito',
  'credito',
  'boleto',
  'fatura',
  'transferencia',
  'dinheiro',
  'outro',
];

const selectClass = 'w-full';

function resultMovementNote(kind: TransactionKind) {
  if (kind === 'card_payment') {
    return 'Fora dos cálculos: pagamento de fatura separado do resultado real.';
  }

  if (kind === 'card_payment_received') {
    return 'Fora dos cálculos: pagamento recebido na fatura separado da receita real.';
  }

  return '';
}

function createEditDraft(transaction: Transaction): EditDraft {
  return {
    category: transaction.category,
    kind: transaction.kind,
    notes: transaction.notes ?? '',
    needsReview: transaction.needsReview,
    manualCategory: transaction.manualCategory,
  };
}

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryMonth = searchParams.get('month');
  const queryCategory = searchParams.get('category')?.trim() || null;
  const [transactions, setTransactions] = useState(() => transactionService.listTransactions());
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => (isValidMonthKey(queryMonth) ? queryMonth : 'all'));
  const [scope, setScope] = useState<ScopeFilter>('consolidado');
  const [category, setCategory] = useState(() => queryCategory ?? 'all');
  const [kind, setKind] = useState<'all' | TransactionKind>('all');
  const [method, setMethod] = useState<'all' | TransactionMethod>('all');
  const [onlyReview, setOnlyReview] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [message, setMessage] = useState('');
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;
  const view: 'list' | 'reembolsos' = searchParams.get('view') === 'reembolsos' ? 'reembolsos' : 'list';
  const hasMonthFilter = month !== 'all';
  const hasCategoryFilter = category !== 'all';
  const hasFinanceFilters = hasMonthFilter || hasCategoryFilter;

  const monthOptions = useMemo(
    () => [...new Set([...(month !== 'all' ? [month] : []), ...transactions.map((transaction) => transaction.date.slice(0, 7))])].sort().reverse(),
    [month, transactions],
  );
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
        const monthMatch = month === 'all' || transaction.date.startsWith(month);
        const scopeMatch = scope === 'all' || scope === 'consolidado' || transaction.scope === scope;
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
      g.total += t.amount;
    }
    return Array.from(groups.entries()).map(([date, data]) => ({ date, ...data }));
  }, [filteredTransactions]);

  useEffect(() => {
    setMonth(isValidMonthKey(queryMonth) ? queryMonth : 'all');
  }, [queryMonth]);

  useEffect(() => {
    setCategory(queryCategory ?? 'all');
  }, [queryCategory]);

  function refreshTransactions() {
    setTransactions(transactionService.listTransactions());
  }

  function startEditing(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditDraft(createEditDraft(transaction));
    setMessage('');
  }

  function stopEditing() {
    setEditingId(null);
    setEditDraft(null);
  }

  function handleSaveReview(event: FormEvent<HTMLFormElement>, transaction: Transaction) {
    event.preventDefault();

    if (!editDraft) {
      return;
    }

    const nextCategory = editDraft.category.trim() || transaction.category;
    const categoryChanged = nextCategory !== transaction.category;

    const reviewUpdates: Parameters<typeof transactionService.reviewTransaction>[1] = {
      notes: editDraft.notes.trim() || undefined,
      needsReview: editDraft.needsReview,
      manualCategory: categoryChanged ? true : editDraft.manualCategory,
      reviewedBy: 'transactions_page',
    };

    if (categoryChanged) {
      reviewUpdates.category = nextCategory;
    }

    if (editDraft.kind !== transaction.kind) {
      reviewUpdates.kind = editDraft.kind;
    }

    transactionService.reviewTransaction(transaction.id, reviewUpdates);

    refreshTransactions();
    stopEditing();
    setMessage('Revisão salva.');
  }

  function handleMarkReviewed(transaction: Transaction) {
    transactionService.markTransactionReviewed(transaction.id);
    refreshTransactions();
    setMessage('Transação marcada como revisada.');
  }

  function changeMonth(value: string) {
    setMonth(value);
    const nextSearchParams = new URLSearchParams(searchParams);

    if (isValidMonthKey(value)) {
      nextSearchParams.set('month', value);
    } else {
      nextSearchParams.delete('month');
    }

    setSearchParams(nextSearchParams);
  }

  function changeCategory(value: string) {
    setCategory(value);
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value && value !== 'all') {
      nextSearchParams.set('category', value);
    } else {
      nextSearchParams.delete('category');
    }

    setSearchParams(nextSearchParams);
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

  function clearFinanceUrlFilters() {
    setMonth('all');
    setCategory('all');
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('month');
    nextSearchParams.delete('category');
    setSearchParams(nextSearchParams);
  }

  function emptyFilterDescription() {
    if (hasMonthFilter && hasCategoryFilter) {
      return `Nenhuma transação encontrada em ${category} para ${formatMonthLabel(month)}.`;
    }

    if (hasCategoryFilter) {
      return `Nenhuma transação encontrada em ${category}.`;
    }

    if (hasMonthFilter) {
      return `Nenhuma transação encontrada para ${formatMonthLabel(month)}.`;
    }

    return 'Ajuste os filtros para voltar a ver os itens salvos.';
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Transações" tabs={getFinanceTabs(pendingReviewCount)} />

      {/* Toggle Transações / Reembolsos */}
      <div className="flex items-center gap-2" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setView('list')}
          className="transition-opacity hover:opacity-80"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: 'var(--hub-radius-pill)',
            border: 'none',
            cursor: 'pointer',
            background: view === 'list' ? 'color-mix(in srgb, var(--hub-accent) 14%, transparent)' : 'none',
            color: view === 'list' ? 'var(--hub-accent)' : 'var(--hub-subtle)',
          }}
        >
          Transações
        </button>
        <button
          type="button"
          onClick={() => setView('reembolsos')}
          className="transition-opacity hover:opacity-80"
          style={{
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 14px',
            borderRadius: 'var(--hub-radius-pill)',
            border: 'none',
            cursor: 'pointer',
            background: view === 'reembolsos' ? 'color-mix(in srgb, var(--hub-accent) 14%, transparent)' : 'none',
            color: view === 'reembolsos' ? 'var(--hub-accent)' : 'var(--hub-subtle)',
          }}
        >
          Reembolsos
        </button>
      </div>

      {view === 'reembolsos' ? (
        <ReimbursementsSection month={month} />
      ) : (
        <>
      {/* Filtros URL ativos */}
      {hasFinanceFilters ? (
        <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: '16px' }}>
          {hasMonthFilter ? (
            <FilterChip label={formatMonthLabel(month)} onRemove={() => changeMonth('all')} />
          ) : null}
          {hasCategoryFilter ? (
            <FilterChip label={category} onRemove={() => changeCategory('all')} />
          ) : null}
          <button
            style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}
            className="transition-opacity hover:opacity-70"
            type="button"
            onClick={clearFinanceUrlFilters}
          >
            Limpar tudo
          </button>
        </div>
      ) : null}

      {transactions.length === 0 ? (
        <EmptyFinanceState
          title="Nenhuma transação salva."
          description="Importe um CSV para preencher a lista de transações."
          action={{ label: 'Ir para Importar', to: '/financeiro/importar' }}
        />
      ) : (
        <>
          {/* Painel de filtros */}
          <Card className="mb-5">
            <input
              className="w-full pb-2"
              style={{ marginBottom: '16px', display: 'block' }}
              placeholder="Buscar por descrição ou texto original…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ marginBottom: '10px' }}>
              <FilterSelectInline label="Mês" value={month} onChange={changeMonth}>
                <Select.Option value="all">todos os meses</Select.Option>
                {monthOptions.map((option) => (
                  <Select.Option key={option} value={option}>{formatMonthLabel(option)}</Select.Option>
                ))}
              </FilterSelectInline>
              <FilterSelectInline label="Escopo" value={scope} onChange={(v) => setScope(v as ScopeFilter)}>
                <Select.Option value="consolidado">consolidado</Select.Option>
                <Select.Option value="pessoal">pessoal</Select.Option>
                <Select.Option value="empresa">empresa</Select.Option>
                <Select.Option value="all">todos</Select.Option>
              </FilterSelectInline>
              <FilterSelectInline label="Categoria" value={category} onChange={changeCategory}>
                <Select.Option value="all">todas as categorias</Select.Option>
                {filterCategoryOptions.map((option) => (
                  <Select.Option key={option} value={option}>{option}</Select.Option>
                ))}
              </FilterSelectInline>
              <FilterSelectInline label="Tipo" value={kind} onChange={(v) => setKind(v as 'all' | TransactionKind)}>
                <Select.Option value="all">todos os tipos</Select.Option>
                {kindOptions.map((option) => (
                  <Select.Option key={option} value={option}>{formatTransactionKind(option)}</Select.Option>
                ))}
              </FilterSelectInline>
              <FilterSelectInline label="Método de pagamento" value={method} onChange={(v) => setMethod(v as 'all' | TransactionMethod)}>
                <Select.Option value="all">todos os métodos</Select.Option>
                {methodOptions.map((option) => (
                  <Select.Option key={option} value={option}>{formatTransactionMethod(option)}</Select.Option>
                ))}
              </FilterSelectInline>
              <label className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-70" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
                <input
                  className="h-3 w-3 rounded accent-indigo-400"
                  type="checkbox"
                  checked={onlyReview}
                  onChange={(event) => setOnlyReview(event.target.checked)}
                />
                só pendentes
              </label>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--hub-disabled)' }}>
              {filteredTransactions.length} de {transactions.length} transação(ões)
            </p>
          </Card>

          {message ? (
            <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '12px' }}>{message}</p>
          ) : null}

          {filteredTransactions.length === 0 ? (
            <section className="grid gap-3">
              <EmptyFinanceState
                title="Nenhuma transação encontrada."
                description={emptyFilterDescription()}
              />
              {hasFinanceFilters ? (
                <div className="flex flex-wrap items-center gap-4" style={{ marginTop: '12px' }}>
                  {hasCategoryFilter ? (
                    <button className="text-xs transition-opacity hover:opacity-60" style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }} type="button" onClick={() => changeCategory('all')}>
                      limpar categoria ×
                    </button>
                  ) : null}
                  {hasMonthFilter ? (
                    <button className="text-xs transition-opacity hover:opacity-60" style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }} type="button" onClick={() => changeMonth('all')}>
                      limpar mês ×
                    </button>
                  ) : null}
                  <button className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'color-mix(in srgb, var(--hub-accent) 75%, transparent)', background: 'none', border: 'none', cursor: 'pointer' }} type="button" onClick={clearFinanceUrlFilters}>
                    limpar tudo
                  </button>
                </div>
              ) : null}
            </section>
          ) : (
            /* ── Lista agrupada por data (estilo extrato) ──────────────────── */
            <Card>
              <div className="space-y-6">
                {groupedByDate.map(({ date, transactions: dayTxns, total }, groupIdx) => (
                  <div key={date} style={{ paddingBottom: groupIdx === groupedByDate.length - 1 ? 0 : '24px', borderBottom: groupIdx === groupedByDate.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                    {/* Cabeçalho do dia — tipográfico, sem container */}
                    <div className="mb-1 flex items-baseline justify-between">
                      <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                        {formatDate(date)}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{ fontSize: '10px', fontWeight: 500, color: total < 0 ? 'color-mix(in srgb, var(--hub-negative) 60%, transparent)' : total > 0 ? 'color-mix(in srgb, var(--hub-positive) 60%, transparent)' : 'var(--hub-disabled)' }}
                      >
                        {formatCurrency(total)}
                      </span>
                    </div>

                    {/* Linhas sem container externo */}
                    <div>
                      {dayTxns.map((transaction, idx) => {
                        const resultNote = resultMovementNote(transaction.kind);
                        const isEditing = editingId === transaction.id && editDraft;
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
                                  <span>{transaction.category}</span>
                                  <span>·</span>
                                  <span>{formatTransactionKind(transaction.kind)}</span>
                                  <span>·</span>
                                  <span>{formatTransactionMethod(transaction.method)}</span>
                                  {transaction.accountName ? (
                                    <><span>·</span><span>{transaction.accountName}</span></>
                                  ) : null}
                                  {matchedReimbursement ? (
                                    <><span>·</span><span style={{ color: 'var(--hub-accent)' }}>Reembolso pareado</span></>
                                  ) : null}
                                </p>
                              </div>

                              {/* Valor */}
                              <strong
                                className="shrink-0 text-sm tabular-nums"
                                style={{ fontWeight: 300, color: transaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}
                              >
                                {formatCurrency(transaction.amount)}
                              </strong>

                              {/* Ações */}
                              <div className="flex shrink-0 gap-2">
                                {transaction.needsReview ? (
                                  <button
                                    type="button"
                                    title="Marcar como revisada"
                                    className="text-[11px] font-medium transition-opacity hover:opacity-70"
                                    style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    onClick={() => handleMarkReviewed(transaction)}
                                  >
                                    ✓
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="text-[11px] transition-opacity hover:opacity-70"
                                  style={{ color: isEditing ? 'var(--hub-accent)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                                  onClick={() => (isEditing ? stopEditing() : startEditing(transaction))}
                                >
                                  {isEditing ? '✕' : '···'}
                                </button>
                              </div>
                            </div>

                            {/* Notas / mensagens especiais */}
                            {(resultNote || transaction.notes) && !isEditing ? (
                              <div style={{ borderTop: '1px solid var(--hub-border)', padding: '4px 2px 8px' }}>
                                {resultNote ? <p style={{ fontSize: '10px', color: 'color-mix(in srgb, var(--hub-accent) 70%, transparent)' }}>{resultNote}</p> : null}
                                {transaction.notes ? <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>{transaction.notes}</p> : null}
                              </div>
                            ) : null}

                            {/* Formulário de edição expandido */}
                            {isEditing ? (
                              <form
                                className="grid gap-5"
                                style={{ padding: '14px 2px 18px', borderTop: '1px solid var(--hub-border)' }}
                                onSubmit={(event) => handleSaveReview(event, transaction)}
                              >
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                                  <label className="space-y-1.5">
                                    <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Categoria</span>
                                    <Select
                                      className={selectClass}
                                      value={editDraft.category}
                                      onChange={(nextCategory) => {
                                        setEditDraft({
                                          ...editDraft,
                                          category: nextCategory,
                                          kind: inferKindFromCategory(nextCategory, editDraft.kind, transaction.amount, transaction.description),
                                          manualCategory: true,
                                        });
                                      }}
                                    >
                                      {categoryOptions.map((option) => (
                                        <Select.Option key={option} value={option}>{option}</Select.Option>
                                      ))}
                                    </Select>
                                  </label>
                                  <label className="space-y-1.5">
                                    <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Tipo</span>
                                    <Select
                                      className={selectClass}
                                      value={editDraft.kind}
                                      onChange={(value) => setEditDraft({ ...editDraft, kind: value as TransactionKind })}
                                    >
                                      {kindOptions.map((option) => (
                                        <Select.Option key={option} value={option}>{formatTransactionKind(option)}</Select.Option>
                                      ))}
                                    </Select>
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-70 xl:pt-5" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
                                    <input
                                      className="h-3.5 w-3.5 rounded accent-indigo-400"
                                      type="checkbox"
                                      checked={editDraft.needsReview}
                                      onChange={(event) => setEditDraft({ ...editDraft, needsReview: event.target.checked })}
                                    />
                                    pendente de revisão
                                  </label>
                                  <label className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-70 xl:pt-5" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
                                    <input
                                      className="h-3.5 w-3.5 rounded accent-indigo-400"
                                      type="checkbox"
                                      checked={editDraft.manualCategory}
                                      onChange={(event) => setEditDraft({ ...editDraft, manualCategory: event.target.checked })}
                                    />
                                    categoria manual
                                  </label>
                                </div>
                                <label className="space-y-1.5">
                                  <span style={{ fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>Notas</span>
                                  <textarea
                                    className="w-full leading-6 resize-none"
                                    rows={2}
                                    value={editDraft.notes}
                                    onChange={(event) => setEditDraft({ ...editDraft, notes: event.target.value })}
                                  />
                                </label>
                                <div className="flex items-center gap-5">
                                  <button
                                    className="text-sm font-medium transition-opacity hover:opacity-70"
                                    style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    type="submit"
                                  >
                                    Salvar revisão
                                  </button>
                                  <button
                                    className="text-xs transition-opacity hover:opacity-60"
                                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    type="button"
                                    onClick={stopEditing}
                                  >
                                    cancelar
                                  </button>
                                </div>
                              </form>
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
        </>
      )}
        </>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove(): void }) {
  return (
    <button
      aria-label={`Remover filtro ${label}`}
      className="inline-flex h-7 max-w-full items-center gap-1.5 transition-opacity hover:opacity-70"
      style={{ fontSize: '11px', color: 'color-mix(in srgb, var(--hub-accent) 80%, transparent)' }}
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
