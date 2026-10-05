import { type FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { MonthSelector } from '../components/MonthSelector';
import { EmptyFinanceState } from '../components/EmptyFinanceState';
import { budgetService } from '../services/budgetService';
import { categoryService } from '../services/categoryService';
import { transactionService } from '../services/transactionService';
import { type Budget } from '../types/budget';
import { type FinanceScope } from '../types/finance';
import {
  formatCurrency,
  formatDate,
  formatPercentage,
  formatTransactionKind,
} from '../utils/financeFormatters';
import { getMonthKeyFromQuery } from '../utils/financePeriod';

type BudgetDraft = {
  name: string;
  category: string;
  limit: string;
  scope: FinanceScope;
};

const inputClass = 'w-full';
const selectClass = `${inputClass} cursor-pointer appearance-none`;

function createBudgetDraft(category = categoryService.getAvailableCategories()[0]?.name ?? ''): BudgetDraft {
  return {
    name: '',
    category,
    limit: '',
    scope: 'pessoal',
  };
}

function createBudgetDraftFromBudget(budget: Budget): BudgetDraft {
  return {
    name: budget.name,
    category: budget.category,
    limit: String(budget.limit),
    scope: budget.scope,
  };
}

function statusLabel(status: 'ok' | 'attention' | 'exceeded') {
  return {
    attention: 'Em atenção',
    exceeded: 'Excedido',
    ok: 'Dentro do limite',
  }[status];
}

export function BudgetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [budgets, setBudgets] = useState(() => budgetService.listBudgets());
  const selectedMonth = getMonthKeyFromQuery(searchParams.get('month'));
  const [draft, setDraft] = useState<BudgetDraft>(() => createBudgetDraft());
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;
  const transactions = transactionService.listTransactions();
  const suggestions = budgetService.listDefaultBudgetSuggestions();
  const summary = budgetService.getBudgetsSummary(transactions, selectedMonth);
  const categoryOptions = useMemo(
    () => [
      ...new Set([
        ...categoryService
          .getAvailableCategories()
          .filter((category) => category.type === 'expense' || category.type === 'review')
          .map((category) => category.name),
        ...transactions.map((transaction) => transaction.category),
        ...budgets.map((budget) => budget.category),
      ]),
    ].sort(),
    [budgets, transactions],
  );

  function refreshBudgets() {
    setBudgets(budgetService.listBudgets());
  }

  function resetDraft() {
    setEditingBudgetId(null);
    setDraft(createBudgetDraft());
  }

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        name: draft.name,
        category: draft.category,
        limit: Number(draft.limit.replace(',', '.')),
        scope: draft.scope,
      };

      if (editingBudgetId) {
        budgetService.updateBudget(editingBudgetId, input);
        setMessage('Orçamento atualizado.');
      } else {
        budgetService.createBudget(input);
        setMessage('Orçamento criado.');
      }

      refreshBudgets();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o orçamento.');
    }
  }

  function startEditing(budget: Budget) {
    setEditingBudgetId(budget.id);
    setDraft(createBudgetDraftFromBudget(budget));
    setMessage('');
    setError('');
  }

  function deleteBudget(budget: Budget) {
    if (!window.confirm(`Excluir o orçamento "${budget.name}"?`)) {
      return;
    }

    budgetService.deleteBudget(budget.id);
    refreshBudgets();
    if (editingBudgetId === budget.id) {
      resetDraft();
    }
    setMessage('Orçamento excluído.');
  }

  function useSuggestion(suggestion: Budget) {
    try {
      budgetService.createBudget({
        name: suggestion.name,
        category: suggestion.category,
        categoryId: suggestion.categoryId,
        limit: suggestion.limit,
        scope: suggestion.scope,
      });
      refreshBudgets();
      setMessage(`Sugestão "${suggestion.name}" adicionada.`);
      setError('');
    } catch (suggestionError) {
      setError(suggestionError instanceof Error ? suggestionError.message : 'Não foi possível usar a sugestão.');
    }
  }

  function changeSelectedMonth(month: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('month', getMonthKeyFromQuery(month));
    setSearchParams(nextSearchParams);
  }

  return (
    <div>
      <ModuleHeader
        eyebrow="Módulo · Financeiro"
        title="Orçamentos"
        tabs={getFinanceTabs(pendingReviewCount)}
       
        right={<MonthSelector value={selectedMonth} onChange={changeSelectedMonth} />}
      />

      {/* Métricas de resumo — inline stats */}
      <div className="flex flex-wrap items-end" style={{ gap: '28px', marginBottom: '24px' }}>
        <InlineStat label="Ativos" value={summary.totalActive} />
        <div style={{ width: '1px', background: 'var(--hub-border)', height: '32px' }} />
        <InlineStat label="Dentro do limite" value={summary.withinLimit} tone="positive" />
        <InlineStat label="Em atenção" value={summary.attention} tone="warning" />
        <InlineStat label="Excedidos" value={summary.exceeded} tone="danger" />
        <div style={{ width: '1px', background: 'var(--hub-border)', height: '32px' }} />
        <InlineStat label="Limite total" value={formatCurrency(summary.totalLimit)} />
        <InlineStat label="Gasto" value={formatCurrency(summary.totalSpent)} />
        <InlineStat label="Restante" value={formatCurrency(summary.totalRemaining)} />
      </div>

      {message ? <p style={{ fontSize: '12px', color: 'var(--hub-positive)', marginBottom: '12px' }}>{message}</p> : null}
      {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)', marginBottom: '12px' }}>{error}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
        {/* Formulário + Sugestões */}
        <section className="grid gap-4 content-start">
          <Card>
            <form onSubmit={saveBudget}>
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
                {editingBudgetId ? 'Editar orçamento' : 'Criar orçamento'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
                O uso considera o mês selecionado e a categoria escolhida.
              </p>
              <div className="grid gap-5">
                <Field label="Nome">
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Ex.: Delivery do mês"
                  />
                </Field>
                <Field label="Categoria">
                  <Select
                    className={selectClass}
                    value={draft.category}
                    onChange={(value) => setDraft({ ...draft, category: value })}
                  >
                    {categoryOptions.map((category) => <Select.Option key={category} value={category}>{category}</Select.Option>)}
                  </Select>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Limite mensal (R$)">
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={draft.limit}
                      onChange={(event) => setDraft({ ...draft, limit: event.target.value })}
                      placeholder="600"
                    />
                  </Field>
                  <Field label="Escopo">
                    <Select
                      className={selectClass}
                      value={draft.scope}
                      onChange={(value) => setDraft({ ...draft, scope: value as FinanceScope })}
                    >
                      <Select.Option value="pessoal">Pessoal</Select.Option>
                      <Select.Option value="empresa">Empresa</Select.Option>
                      <Select.Option value="consolidado">Consolidado</Select.Option>
                    </Select>
                  </Field>
                </div>
                <div className="flex items-center gap-5">
                  <button
                    className="text-sm font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                    type="submit"
                  >
                    {editingBudgetId ? 'Salvar orçamento' : 'Criar orçamento'}
                  </button>
                  {editingBudgetId ? (
                    <button
                      className="text-xs transition-opacity hover:opacity-60"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={resetDraft}
                    >
                      cancelar
                    </button>
                  ) : null}
                </div>
              </div>
            </form>

            {/* Sugestões */}
            <div style={{ paddingTop: '24px', marginTop: '24px', borderTop: '1px solid var(--hub-border)' }}>
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
                Sugestões iniciais
              </p>
              <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginBottom: '16px' }}>
                Nada entra automaticamente — clique para adicionar.
              </p>
              <div className="grid gap-0">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={suggestion.id}
                    className="flex min-h-10 items-center justify-between gap-3 text-left transition-opacity hover:opacity-70"
                    style={{
                      paddingBottom: '10px',
                      marginBottom: i === suggestions.length - 1 ? 0 : '10px',
                      borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid var(--hub-border)',
                    }}
                    type="button"
                    onClick={() => useSuggestion(suggestion)}
                  >
                    <span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--hub-text)', fontWeight: 400 }}>{suggestion.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>{suggestion.category}</span>
                    </span>
                    <span style={{ fontSize: '13px', color: 'color-mix(in srgb, var(--hub-accent) 80%, transparent)', fontWeight: 500 }}>{formatCurrency(suggestion.limit)}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </section>

        {/* Lista de orçamentos */}
        {budgets.length === 0 ? (
          <EmptyFinanceState
            title="Nenhum orçamento ativo para este mês."
            description="Crie um limite mensal ou use uma sugestão para acompanhar categorias."
          />
        ) : (
          <Card>
            {budgets.map((budget, budgetIndex) => {
              const usage = budgetService.getBudgetUsage(budget, transactions, selectedMonth);
              const budgetTransactions = budgetService.getBudgetTransactions(budget, transactions, selectedMonth);
              const spentColor = usage.status === 'exceeded' ? 'var(--hub-negative)' : usage.status === 'attention' ? 'var(--hub-warning)' : 'var(--hub-positive)';
              const isLast = budgetIndex === budgets.length - 1;

              return (
                <article key={budget.id} style={{ paddingBottom: isLast ? 0 : '28px', marginBottom: isLast ? 0 : '28px', borderBottom: isLast ? 'none' : '1px solid var(--hub-border)' }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" style={{ marginBottom: '14px' }}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p style={{ fontSize: '15px', color: 'var(--hub-text)', fontWeight: 500 }}>{budget.name}</p>
                        <span style={{ fontSize: '10px', color: spentColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {statusLabel(usage.status)}
                        </span>
                        {!budget.isActive ? (
                          <span style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Inativo
                          </span>
                        ) : null}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '4px' }}>
                        {budget.category} · {budget.scope} · {selectedMonth}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="tabular-nums" style={{ fontSize: '22px', fontWeight: 300, letterSpacing: '-0.02em', color: spentColor }}>
                        {formatCurrency(usage.spent)}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>de {formatCurrency(budget.limit)}</p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mb-3 h-1 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(Math.max(usage.percentUsed, 0), 100)}%`,
                        background: spentColor,
                      }}
                    />
                  </div>

                  {/* Mini stats inline */}
                  <div className="flex flex-wrap gap-5" style={{ marginBottom: '14px' }}>
                    <span>
                      <span style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Restante </span>
                      <span style={{ fontSize: '12px', color: 'var(--hub-text-body)' }}>{formatCurrency(usage.remaining)}</span>
                    </span>
                    <span>
                      <span style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Uso </span>
                      <span style={{ fontSize: '12px', color: 'var(--hub-text-body)' }}>{formatPercentage(usage.percentUsed)}</span>
                    </span>
                    <span>
                      <span style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transações </span>
                      <span style={{ fontSize: '12px', color: 'var(--hub-text-body)' }}>{usage.transactionsCount}</span>
                    </span>
                  </div>

                  {usage.spent < 0 ? (
                    <p style={{ fontSize: '12px', color: 'color-mix(in srgb, var(--hub-accent) 75%, transparent)', marginBottom: '10px' }}>
                      Refunds superaram os gastos — aparece como crédito/ajuste.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-4">
                    <button
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={() => startEditing(budget)}
                    >
                      Editar
                    </button>
                    <button
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={() => {
                        budgetService.toggleBudget(budget.id);
                        refreshBudgets();
                      }}
                    >
                      {budget.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      onClick={() => deleteBudget(budget)}
                    >
                      Excluir
                    </button>
                  </div>

                  {/* Transações do orçamento */}
                  <details style={{ marginTop: '12px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '11px', color: 'var(--hub-subtle)', userSelect: 'none' }}>
                      Ver transações consideradas ({budgetTransactions.length})
                    </summary>
                    {budgetTransactions.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '10px' }}>
                        Nenhuma transação entrou neste orçamento em {selectedMonth}.
                      </p>
                    ) : (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {budgetTransactions.map((transaction, txIndex) => (
                          <div
                            key={transaction.id}
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                            style={{
                              paddingBottom: '8px',
                              marginBottom: txIndex === budgetTransactions.length - 1 ? 0 : '8px',
                              borderBottom: txIndex === budgetTransactions.length - 1 ? 'none' : '1px solid var(--hub-border)',
                            }}
                          >
                            <div className="min-w-0">
                              <p style={{ fontSize: '13px', color: 'var(--hub-text-body)', fontWeight: 400 }}>{transaction.description}</p>
                              <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '2px' }}>
                                {formatDate(transaction.date)} · {transaction.category} · {formatTransactionKind(transaction.kind)}
                              </p>
                            </div>
                            <p className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: transaction.kind === 'refund' ? 'color-mix(in srgb, var(--hub-accent) 80%, transparent)' : 'var(--hub-negative)' }}>
                              {transaction.kind === 'refund' ? '-' : ''}{formatCurrency(Math.abs(transaction.amount))}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </details>
                </article>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="space-y-1.5">
      <span style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--hub-subtle)', fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function InlineStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
  value: number | string;
}) {
  const valueColor = {
    danger: 'var(--hub-negative)',
    neutral: 'var(--hub-text)',
    positive: 'var(--hub-positive)',
    warning: 'var(--hub-warning)',
  }[tone];

  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
        {label}
      </p>
      <p className="tabular-nums" style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.02em', color: valueColor }}>
        {value}
      </p>
    </div>
  );
}
