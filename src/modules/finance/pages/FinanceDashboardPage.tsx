import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { MonthSelector } from '../components/MonthSelector';
import { EmptyFinanceState } from '../components/EmptyFinanceState';
import { budgetService } from '../services/budgetService';
import { cardService } from '../services/cardService';
import { financeSummaryService } from '../services/financeSummaryService';
import { invoiceService } from '../services/invoiceService';
import { reimbursementService } from '../services/reimbursementService';
import { transactionService } from '../services/transactionService';
import {
  filterTransactionsBySelectedMonth,
  isMatchedReimbursement,
} from '../utils/financeCalculations';
import { formatCurrency } from '../utils/financeFormatters';
import {
  formatMonthLabel,
  getCurrentMonthKey,
  getMonthKeyFromQuery,
  withMonthAndCategoryParams,
  withMonthParam,
  withReimbursementsParams,
} from '../utils/financePeriod';
import type { MonthlyEvolutionPoint } from '../types/finance';

export function FinanceDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMonth = getMonthKeyFromQuery(searchParams.get('month'));
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;

  const transactions = transactionService.listTransactions();
  const monthlyTransactions = filterTransactionsBySelectedMonth(transactions, selectedMonth)
    .filter((t) => !isMatchedReimbursement(t));
  const summary = financeSummaryService.getFinanceSummary(selectedMonth);
  const monthlyEvolution = financeSummaryService.getMonthlyEvolution(selectedMonth, 6);
  const monthlyComparison = financeSummaryService.getMonthlyComparison(selectedMonth);
  const categoryExpenses = useMemo(
    () =>
      financeSummaryService
        .getCategoryExpenses(selectedMonth)
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [selectedMonth, transactions],
  );
  const categoryComparison = useMemo(
    () => {
      const data = financeSummaryService.getMonthlyCategoryComparison(selectedMonth);
      return new Map(data.map((item) => [item.category, item]));
    },
    [selectedMonth, transactions],
  );
  const budgetSummary = budgetService.getBudgetsSummary(transactions, selectedMonth);
  const reimbursementPairs = reimbursementService
    .listReimbursementPairs()
    .filter((pair) => pair.refund.date.startsWith(selectedMonth));

  const balanceDelta = monthlyComparison.deltas.balance.difference;
  const incomeDelta = monthlyComparison.deltas.income.difference;

  function changeSelectedMonth(month: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('month', getMonthKeyFromQuery(month));
    setSearchParams(nextSearchParams);
  }

  // ── Cartão de crédito — fatura e limite (só mês atual) ─────────────────
  const cardInfo = useMemo(() => {
    if (!isCurrentMonth) return null;
    const card = cardService.listCards().find((c) => c.type === 'credit' && c.isActive);
    // Fallback: usa cardPurchases do summary quando cartão não tem fechamento configurado
    const cardPurchasesTotal = summary.cardPurchases;
    if (!card && cardPurchasesTotal === 0) return null;
    const invoice = invoiceService.getCurrentInvoice();
    const invoiceTotal = invoice?.total ?? 0;
    // Se não há fatura derivada mas há compras no mês, mostra o total do mês como referência
    const effectiveTotal = invoiceTotal > 0 ? invoiceTotal : cardPurchasesTotal;
    if (effectiveTotal === 0 && (card?.limit == null)) return null;
    return {
      cardName: card?.name ?? 'Cartão de crédito',
      cardLimit: card?.limit ?? null,
      invoiceTotal: effectiveTotal,
      invoiceDueDate: invoice?.dueDate ?? null,
      invoiceIsExact: invoiceTotal > 0, // true = fatura real derivada; false = soma do mês
      limitAvailable: card?.limit != null ? card.limit - effectiveTotal : null,
    };
  }, [isCurrentMonth, summary.cardPurchases]);

  // ── Projeção de fim de mês (só para o mês atual) ────────────────────────
  const projection = useMemo(() => {
    if (!isCurrentMonth || monthlyTransactions.length === 0) return null;
    const today = new Date();
    const dayOfMonth = today.getDate();
    if (dayOfMonth < 3) return null; // poucos dados para projetar
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - dayOfMonth;
    if (daysRemaining <= 0) return null;
    const dailyAvg = summary.cashExpenses / dayOfMonth;
    const projected = summary.cashExpenses + dailyAvg * daysRemaining;
    return { dailyAvg, projected, daysRemaining };
  }, [isCurrentMonth, monthlyTransactions.length, summary.cashExpenses]);

  return (
    <div>
      <ModuleHeader
        eyebrow="Módulo · Financeiro"
        title="Painel"
        tabs={getFinanceTabs(pendingReviewCount)}
       
        right={<MonthSelector value={selectedMonth} onChange={changeSelectedMonth} />}
      />

      {transactions.length === 0 ? (
        <EmptyFinanceState
          title="Nenhuma transação local ainda."
          description="Importe um CSV para preencher o resumo financeiro."
          action={{ label: 'Importar CSV', to: '/financeiro/importar' }}
        />
      ) : (
        <>
          {/* ── Hero — resultado principal + receitas/gastos/status ────── */}
          <Card className="mb-5">
            <p
              className="font-medium uppercase"
              style={{ fontSize: '11px', letterSpacing: '0.14em', color: 'var(--hub-subtle)', marginBottom: '12px' }}
            >
              {isCurrentMonth ? 'Disponível pra gastar' : `Resultado — ${formatMonthLabel(selectedMonth)}`}
            </p>
            <p
              className="leading-none tabular-nums"
              style={{
                fontSize: '58px',
                fontWeight: 300,
                letterSpacing: '-0.03em',
                color: summary.balance >= 0 ? 'var(--hub-text)' : 'var(--hub-negative)',
                marginBottom: '11px',
              }}
            >
              {formatCurrency(summary.balance)}
            </p>
            {balanceDelta !== 0 && (
              <p style={{ fontSize: '12px', color: balanceDelta > 0 ? 'var(--hub-positive)' : 'var(--hub-negative)', letterSpacing: '0.01em' }}>
                {balanceDelta > 0 ? '+' : ''}
                {formatCurrency(balanceDelta)} {balanceDelta > 0 ? 'acima' : 'abaixo'} do mês anterior
              </p>
            )}
            {/* Crédito não pago ainda: mostra pendência sem deduzir do saldo */}
            {isCurrentMonth && summary.cardPurchases > 0 && summary.cardPayments === 0 && (
              <p style={{ fontSize: '11px', color: 'var(--hub-disabled)', marginTop: '8px' }}>
                <span className="tabular-nums">{formatCurrency(summary.cardPurchases)}</span>
                {' '}em crédito · saldo cai ao pagar a fatura
              </p>
            )}
            {projection && (
              <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '8px' }}>
                <span style={{ color: 'var(--hub-subtle)' }}>média diária </span>
                <span className="tabular-nums" style={{ color: 'var(--hub-text-body)' }}>
                  {formatCurrency(projection.dailyAvg)}
                </span>
                <span style={{ color: 'var(--hub-disabled)' }}> · projeção </span>
                <span
                  className="tabular-nums"
                  style={{ color: projection.projected > summary.income ? 'var(--hub-negative)' : 'var(--hub-text-body)' }}
                >
                  {formatCurrency(projection.projected)}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--hub-disabled)', marginLeft: '4px' }}>
                  (inclui fixos)
                </span>
              </p>
            )}

            <div
              className="flex flex-wrap items-start"
              style={{ gap: '44px', marginTop: '32px', paddingTop: '28px', borderTop: '1px solid var(--hub-border)' }}
            >
              {/* Receitas */}
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-subtle)', marginBottom: '7px' }}>
                  Receitas
                </p>
                <p className="tabular-nums" style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
                  {formatCurrency(summary.income)}
                </p>
                {incomeDelta !== 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--hub-positive)', marginTop: '5px', opacity: 0.75 }}>
                    {incomeDelta > 0 ? '+' : ''}
                    {formatCurrency(incomeDelta)} de {getPrevMonthLabel(selectedMonth)}
                  </p>
                )}
              </div>

              <div className="shrink-0" style={{ width: '1px', background: 'var(--hub-border)', height: '50px', marginTop: '15px' }} />

              {/* Gastos — débito/PIX apenas */}
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-subtle)', marginBottom: '7px' }}>
                  Gastos
                </p>
                <p className="tabular-nums" style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-negative)' }}>
                  {formatCurrency(summary.cashExpenses)}
                </p>
                {summary.refundAdjustments ? (
                  <p style={{ fontSize: '11px', color: 'var(--hub-negative)', marginTop: '5px', opacity: 0.6 }}>
                    {formatCurrency(summary.refundAdjustments)} abatidos em reembolsos
                  </p>
                ) : null}
              </div>

              {/* Pgto. Fatura — cash outflow separado */}
              {summary.cardPayments > 0 && (
                <>
                  <div className="shrink-0" style={{ width: '1px', background: 'var(--hub-border)', height: '50px', marginTop: '15px' }} />
                  <div>
                    <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-subtle)', marginBottom: '7px' }}>
                      Pgto. Fatura
                    </p>
                    <p className="tabular-nums" style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-negative)' }}>
                      {formatCurrency(summary.cardPayments)}
                    </p>
                  </div>
                </>
              )}

              {/* Status — direita */}
              <div className="ml-auto flex flex-col items-end" style={{ gap: '8px', paddingTop: '3px' }}>
                {summary.requiredReviewCount > 0 && (
                  <Link
                    to={withMonthParam('/financeiro/revisao', selectedMonth)}
                    className="flex items-center transition-opacity hover:opacity-80"
                    style={{ gap: '6px', cursor: 'pointer' }}
                  >
                    <span
                      className="shrink-0 rounded-full"
                      style={{ width: '5px', height: '5px', background: 'var(--hub-warning)' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--hub-text-body)' }}>
                      {summary.requiredReviewCount} pendência{summary.requiredReviewCount !== 1 ? 's' : ''}
                    </span>
                  </Link>
                )}
                {reimbursementPairs.length > 0 && (
                  <Link
                    to={withReimbursementsParams(selectedMonth)}
                    className="transition-opacity hover:opacity-80"
                    style={{ fontSize: '11px', color: 'var(--hub-muted)' }}
                  >
                    {reimbursementPairs.length} reembolso{reimbursementPairs.length !== 1 ? 's' : ''} pareado{reimbursementPairs.length !== 1 ? 's' : ''}
                  </Link>
                )}
                <span style={{ fontSize: '11px', color: 'var(--hub-muted)' }}>
                  {summary.transactionCount} lançamento{summary.transactionCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </Card>

          {/* ── Cartão de crédito ────────────────────────────────────────── */}
          {cardInfo && (cardInfo.invoiceTotal > 0 || cardInfo.cardLimit != null) && (
            <Card className="mb-5">
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}>
                Cartão
              </p>
              <div className="flex flex-wrap" style={{ gap: '28px' }}>
                {/* Fatura / compras no crédito */}
                {cardInfo.invoiceTotal > 0 && (
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
                      {cardInfo.invoiceIsExact ? 'Fatura em aberto' : 'Compras no crédito'}
                    </p>
                    <p className="tabular-nums" style={{ fontSize: '20px', fontWeight: 300, color: 'var(--hub-negative)', letterSpacing: '-0.01em' }}>
                      {formatCurrency(cardInfo.invoiceTotal)}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
                      {cardInfo.invoiceDueDate
                        ? `vence ${new Date(cardInfo.invoiceDueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · `
                        : ''}
                      saldo cai ao pagar; limite é restaurado
                    </p>
                  </div>
                )}
                {/* Limite disponível */}
                {cardInfo.cardLimit != null && (
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
                      Limite disponível
                    </p>
                    <p className="tabular-nums" style={{ fontSize: '20px', fontWeight: 300, color: 'var(--hub-text)', letterSpacing: '-0.01em' }}>
                      {formatCurrency(cardInfo.limitAvailable ?? 0)}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
                      de {formatCurrency(cardInfo.cardLimit)} total
                      {' · '}compras reduzem o limite, não o saldo
                    </p>
                  </div>
                )}
              </div>
              {/* Nota explicativa quando só há fatura mas não limite configurado */}
              {cardInfo.cardLimit == null && cardInfo.invoiceTotal > 0 && (
                <p style={{ fontSize: '10px', color: 'var(--hub-disabled)', marginTop: '12px' }}>
                  Compras no crédito reduzem o limite do cartão, não o saldo. O saldo cai ao pagar a fatura.
                  {' '}Configure o limite em Configurações para ver o limite disponível.
                </p>
              )}
            </Card>
          )}

          {/* ── Alertas de contexto ──────────────────────────────────────── */}
          {(monthlyTransactions.length === 0 || summary.pendingIncomeReview > 0 || summary.pendingExpenseReview > 0 || budgetSummary.exceeded > 0) && (
            <ul style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {monthlyTransactions.length === 0 && (
                <li style={{ fontSize: '11px', color: 'var(--hub-muted)' }}>
                  Nenhuma transação encontrada para este mês.
                </li>
              )}
              {summary.pendingIncomeReview > 0 && (
                <li style={{ fontSize: '11px', color: 'var(--hub-warning)' }}>
                  Entradas a revisar ainda não contam como renda.
                </li>
              )}
              {summary.pendingExpenseReview > 0 && (
                <li style={{ fontSize: '11px', color: 'var(--hub-warning)' }}>
                  Despesas a revisar podem alterar os gastos reais.
                </li>
              )}
              {budgetSummary.exceeded > 0 && (
                <li style={{ fontSize: '11px', color: 'color-mix(in srgb, var(--hub-negative) 90%, transparent)' }}>
                  <Link to={withMonthParam('/financeiro/orcamentos', selectedMonth)} className="hover:opacity-80 transition-opacity">
                    {budgetSummary.exceeded} orçamento{budgetSummary.exceeded !== 1 ? 's' : ''} excedido{budgetSummary.exceeded !== 1 ? 's' : ''} →
                  </Link>
                </li>
              )}
            </ul>
          )}

          {/* ── Grid: maiores gastos + evolução ──────────────────────────── */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Maiores gastos */}
            {categoryExpenses.length > 0 && (
              <Card>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
                  Maiores gastos
                </p>
                {categoryExpenses.map((item, i) => {
                  const maxAmount = categoryExpenses[0]?.amount ?? 1;
                  const pct = Math.round((item.amount / maxAmount) * 100);
                  const trend = categoryComparison.get(item.category);
                  const trendPct = trend?.percentChange ?? null;
                  return (
                    <Link
                      key={item.category}
                      to={withMonthAndCategoryParams('/financeiro/transacoes', selectedMonth, item.category)}
                      className="group block"
                      style={{ marginBottom: i === categoryExpenses.length - 1 ? 0 : '20px' }}
                    >
                      <div className="flex items-baseline justify-between" style={{ marginBottom: '7px' }}>
                        <span
                          className="transition-colors group-hover:opacity-80"
                          style={{ fontSize: '14px', color: 'var(--hub-text-body)' }}
                        >
                          {item.category}
                        </span>
                        <div className="flex items-baseline" style={{ gap: '9px' }}>
                          {trendPct !== null && Math.abs(trendPct) >= 5 && (
                            <span
                              className="tabular-nums"
                              style={{ fontSize: '10px', color: trendPct > 0 ? 'var(--hub-negative)' : 'var(--hub-positive)', opacity: 0.80 }}
                            >
                              {trendPct > 0 ? '↑' : '↓'}{Math.round(Math.abs(trendPct))}%
                            </span>
                          )}
                          <span className="tabular-nums" style={{ fontSize: '13px', color: 'var(--hub-text-body)', letterSpacing: '-0.01em' }}>
                            {formatCurrency(item.amount)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-full" style={{ height: '2px', background: 'var(--hub-border)' }}>
                        <div
                          className="h-full rounded-full transition-opacity group-hover:opacity-70"
                          style={{ width: `${pct}%`, background: 'var(--hub-accent)', opacity: 0.52 }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--hub-muted)', marginTop: '5px' }}>
                        {item.transactionsCount} transaç{item.transactionsCount !== 1 ? 'ões' : 'ão'}
                      </p>
                    </Link>
                  );
                })}
              </Card>
            )}

            {/* Evolução — lista de meses */}
            {monthlyEvolution.length > 0 && (
              <Card>
                <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                  <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
                    Evolução — {monthlyEvolution.length} meses
                  </p>
                  <Link
                    to={withMonthParam('/financeiro/relatorios', selectedMonth)}
                    style={{ fontSize: '11px', color: 'color-mix(in srgb, var(--hub-accent) 90%, transparent)' }}
                    className="hover:opacity-80 transition-opacity"
                  >
                    Relatório →
                  </Link>
                </div>
                <EvolutionList data={monthlyEvolution} currentMonth={selectedMonth} />
              </Card>
            )}
          </div>

          {/* Atalhos discretos */}
          <p className="flex flex-wrap" style={{ gap: '20px', marginTop: '28px', fontSize: '11px', color: 'var(--hub-muted)' }}>
            <Link to={withMonthParam('/financeiro/relatorios', selectedMonth)} className="hover:opacity-80 transition-opacity">
              ✨ Análise IA
            </Link>
            <Link to="/financeiro/importar" className="hover:opacity-80 transition-opacity">
              Importar
            </Link>
            <Link to="/financeiro/categorias" className="hover:opacity-80 transition-opacity">
              Categorias
            </Link>
            <Link to={withReimbursementsParams(selectedMonth)} className="hover:opacity-80 transition-opacity">
              Reembolsos
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

/** Lista de evolução mensal — substitui o SVG chart na dashboard */
function EvolutionList({
  data,
  currentMonth,
}: {
  data: MonthlyEvolutionPoint[];
  currentMonth: string;
}) {
  const lastIdx = data.length - 1;

  return (
    <div>
      {data.map((point, i) => {
        const isCurrent = i === lastIdx;
        const hasData = point.transactionCount > 0;
        const opacity = !hasData ? 0.25 : isCurrent ? 1 : 0.75;

        return (
          <div
            key={point.month}
            className="flex items-baseline justify-between"
            style={{
              padding: isCurrent ? '9px 0' : '8px 0',
              borderBottom: i < lastIdx ? '1px solid var(--hub-border)' : undefined,
              opacity,
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: isCurrent ? 'var(--hub-text)' : 'var(--hub-muted)',
                fontWeight: isCurrent ? 500 : 400,
                textTransform: 'capitalize',
              }}
            >
              {point.label}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '13px',
                letterSpacing: '-0.01em',
                color: !hasData
                  ? 'var(--hub-disabled)'
                  : point.balance >= 0
                  ? 'var(--hub-positive)'
                  : 'var(--hub-negative)',
                opacity: isCurrent ? 1 : 0.72,
              }}
            >
              {hasData
                ? `${point.balance >= 0 ? '+' : ''}${formatCurrency(point.balance)}`
                : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Retorna o label do mês anterior (ex: "maio") */
function getPrevMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const prev = new Date(y, m - 2, 1);
  return prev.toLocaleString('pt-BR', { month: 'long' });
}
