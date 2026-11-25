import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card } from '../../../shared/ui';
import { ModuleAttentionCard } from '../../../core/alerts/ModuleAttentionCard';
import { financeAlertProvider } from '../alerts/financeAlertProvider';
import { getFinanceTabs } from '../components/financeTabs';
import { MonthSelector } from '../components/MonthSelector';
import { EmptyFinanceState } from '../components/EmptyFinanceState';
import { CategorySpendingCard } from '../components/CategorySpendingCard';
import { financeSummaryService } from '../services/financeSummaryService';
import { invoiceService } from '../services/invoiceService';
import { listUpcomingFixedCosts } from '../services/fixedCostService';
import { reimbursementService } from '../services/reimbursementService';
import { transactionService } from '../services/transactionService';
import { financialMonthRange, isInFinancialMonth } from '../../../shared/finance/financeMonth.js';
import { formatCurrency } from '../utils/financeFormatters';
import {
  formatMonthLabel,
  getCurrentMonthKey,
  getMonthKeyFromQuery,
  getMonthStartDay,
  withMonthAndCategoryParams,
  withMonthParam,
  withReimbursementsParams,
} from '../utils/financePeriod';
import type { MonthlyEvolutionPoint } from '../types/finance';

const DAY_MS = 86_400_000;
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

/** Days from today to the end of the financial month, today included. */
function daysLeftInMonth(monthKey: string) {
  const { end } = financialMonthRange(monthKey, getMonthStartDay());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return { end, days: Math.round((new Date(`${end}T00:00:00`).getTime() - today) / DAY_MS) + 1 };
}

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' } as const;

/**
 * Resumo — the module's answer first ("how much is left and what can I still
 * spend"), what needs the user beside it, details below.
 */
export function FinanceDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMonth = getMonthKeyFromQuery(searchParams.get('month'));
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();
  const pendingReviewCount = transactionService.listCurrentMonthReviewTransactions().length;

  const transactions = transactionService.listTransactions();
  const summary = financeSummaryService.getFinanceSummary(selectedMonth);
  const monthlyEvolution = financeSummaryService.getMonthlyEvolution(selectedMonth, 6);
  const balanceDelta = financeSummaryService.getMonthlyComparison(selectedMonth).deltas.balance.difference;
  const reimbursementCount = reimbursementService
    .listReimbursementPairs()
    .filter((pair) => isInFinancialMonth(pair.refund.date, selectedMonth, getMonthStartDay())).length;

  function changeSelectedMonth(month: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('month', getMonthKeyFromQuery(month));
    setSearchParams(nextSearchParams);
  }

  // The answer under the big number: how much per day keeps the month positive.
  const answer = useMemo(() => {
    if (summary.balance < 0) {
      return { text: `Você gastou ${formatCurrency(-summary.balance)} a mais do que recebeu${isCurrentMonth ? ' até agora' : ''}.`, tone: 'var(--hub-negative)' };
    }
    if (!isCurrentMonth) {
      return { text: summary.transactionCount > 0 ? 'Fechou no azul.' : 'Nenhum lançamento neste mês.', tone: 'var(--hub-muted)' };
    }
    if (summary.income <= 0) {
      return { text: 'Nenhuma entrada ainda neste mês — o que sobra aparece quando cair o primeiro dinheiro.', tone: 'var(--hub-muted)' };
    }
    const { end, days } = daysLeftInMonth(selectedMonth);
    if (days <= 0) return null;
    const endLabel = shortDate.format(new Date(`${end}T12:00:00`));
    // Bills that come back every month and haven't been paid yet are already spoken for.
    const fixed = listUpcomingFixedCosts(transactions, selectedMonth);
    const reserved = fixed.reduce((sum, item) => sum + item.amount, 0);
    const free = summary.balance - reserved;
    const names = fixed.slice(0, 3).map((item) => item.merchant).join(', ') + (fixed.length > 3 ? '…' : '');
    if (free <= 0) {
      return {
        text: `As contas fixas que ainda vêm (${formatCurrency(reserved)}: ${names}) já levam o que sobrou — segure os gastos até ${endLabel}.`,
        tone: 'var(--hub-warning)',
      };
    }
    return {
      text: `Dá para gastar ${formatCurrency(free / days)} por dia até ${endLabel} e fechar no azul`
        + (reserved > 0 ? `, já separando ${formatCurrency(reserved)} de contas fixas que ainda vêm (${names}).` : '.'),
      tone: 'var(--hub-text-body)',
    };
  }, [isCurrentMonth, selectedMonth, summary.balance, summary.income, summary.transactionCount, transactions]);

  // Credit card — the bill to pay (closed, unpaid) or the open one, and the limit
  // really left (current month only). Same numbers as the Cartão tab.
  // One entry per card; without a registered card, the month's credit purchases.
  const cardInfos = useMemo(() => {
    if (!isCurrentMonth) return [];
    const usages = invoiceService.listCardUsages();
    if (usages.length === 0 && summary.cardPurchases === 0) return [];
    return (usages.length > 0 ? usages : [null]).map((usage) => {
    const bill = usage?.toPay ?? usage?.open ?? null;
    const total = bill ? bill.total : summary.cardPurchases;
    return {
      id: usage?.card.id ?? 'none',
      name: usage?.card.name ?? 'Cartão de crédito',
      limit: usage?.card.limit ?? null,
      free: usage?.free ?? null,
      used: usage?.used ?? total,
      total,
      label: usage?.toPay ? 'fatura fechada a pagar' : bill ? 'fatura aberta' : 'compras no crédito neste mês',
      toPay: Boolean(usage?.toPay),
      closingDate: usage?.toPay ? null : bill?.closingDate ?? null,
      dueDate: bill?.dueDate ?? null,
    };
    });
  }, [isCurrentMonth, summary.cardPurchases]);

  const header = (
    <ModuleHeader
      eyebrow="Módulo · Financeiro"
      title="Resumo"
      tabs={getFinanceTabs(pendingReviewCount)}
      right={<MonthSelector value={selectedMonth} onChange={changeSelectedMonth} />}
    />
  );

  if (transactions.length === 0) {
    return (
      <div>
        {header}
        <EmptyFinanceState
          title="Nenhuma transação ainda."
          description="Importe o extrato do banco (CSV) para o Olimpo montar o resumo do seu mês."
          action={{ label: 'Importar extrato', to: '/financeiro/configurar/importar' }}
        />
      </div>
    );
  }

  return (
    <div>
      {header}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* The answer */}
          <Card hero>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '10px' }}>
              {isCurrentMonth ? 'Sobrou até agora' : `Sobrou em ${formatMonthLabel(selectedMonth)}`}
            </p>
            <p
              className="leading-none tabular-nums"
              style={{ fontSize: 'clamp(34px, 10vw, 52px)', fontWeight: 400, letterSpacing: '-0.03em', color: summary.balance >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)' }}
            >
              {formatCurrency(summary.balance)}
            </p>
            {answer ? <p style={{ fontSize: '14px', color: answer.tone, marginTop: '12px', lineHeight: 1.5 }}>{answer.text}</p> : null}
            {/* A month in progress against a whole one is always "a mais": compare closed months only. */}
            {balanceDelta !== 0 && !isCurrentMonth ? (
              <p className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '4px' }}>
                {formatCurrency(Math.abs(balanceDelta))} {balanceDelta > 0 ? 'a mais' : 'a menos'} que o mês anterior
              </p>
            ) : null}

            <div
              className="flex flex-wrap items-baseline tabular-nums"
              style={{ gap: '8px 28px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--hub-border)', fontSize: '13px' }}
            >
              <span style={{ color: 'var(--hub-subtle)' }}>
                Recebi <span style={{ color: 'var(--hub-text)' }}>{formatCurrency(summary.income)}</span>
              </span>
              <Link to={withMonthParam('/financeiro/gastos', selectedMonth)} className="transition-opacity hover:opacity-70" style={{ color: 'var(--hub-subtle)' }}>
                Gastei <span style={{ color: 'var(--hub-text)' }}>{formatCurrency(summary.expenses)}</span>
              </Link>
              {summary.cardPurchases > 0 ? (
                <span style={{ color: 'var(--hub-subtle)' }}>{formatCurrency(summary.cardPurchases)} no cartão</span>
              ) : null}
              {summary.refundAdjustments ? (
                <span style={{ color: 'var(--hub-subtle)' }}>{formatCurrency(summary.refundAdjustments)} de reembolsos abatidos</span>
              ) : null}
            </div>
          </Card>

          {/* On a phone what needs the user comes right after the answer. */}
          <ModuleAttentionCard provider={financeAlertProvider} className="lg:hidden" />

          <CategorySpendingCard
            month={selectedMonth}
            footer={{ label: 'ver todos os gastos', to: withMonthParam('/financeiro/gastos', selectedMonth) }}
          />

          {monthlyEvolution.length > 0 ? (
            <Card>
              <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '6px' }}>
                Quanto sobrou nos últimos meses
              </p>
              <EvolutionList data={monthlyEvolution} />
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModuleAttentionCard provider={financeAlertProvider} className="hidden lg:block" />

          {cardInfos.map((cardInfo) => (
            <Card key={cardInfo.id}>
              <div className="flex items-baseline justify-between">
                <p className="font-medium uppercase" style={sectionLabel}>{cardInfo.name}</p>
                <Link to={cardInfos.length > 1 ? `/financeiro/cartao?card=${cardInfo.id}` : '/financeiro/cartao'} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
                  fatura →
                </Link>
              </div>
              <p className="tabular-nums" style={{ fontSize: '22px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--hub-text)', marginTop: '8px' }}>
                {formatCurrency(cardInfo.total)}
              </p>
              <p className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '2px' }}>
                <span style={{ color: cardInfo.toPay ? 'var(--hub-warning)' : undefined }}>{cardInfo.label}</span>
                {cardInfo.closingDate ? ` · fecha ${shortDate.format(new Date(`${cardInfo.closingDate}T12:00:00`))}` : ''}
                {cardInfo.dueDate ? ` · vence ${shortDate.format(new Date(`${cardInfo.dueDate}T12:00:00`))}` : ''}
              </p>
              {cardInfo.limit != null && cardInfo.free != null ? (
                <>
                  <div style={{ height: '4px', marginTop: '12px', background: 'var(--hub-track)', borderRadius: 'var(--hub-radius-control)' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, Math.round((cardInfo.used / cardInfo.limit) * 100)))}%`,
                        height: '4px',
                        borderRadius: 'var(--hub-radius-control)',
                        background: cardInfo.free < 0 ? 'var(--hub-negative)' : 'var(--hub-accent)',
                      }}
                    />
                  </div>
                  <p className="tabular-nums" style={{ fontSize: '12px', color: cardInfo.free < 0 ? 'var(--hub-negative)' : 'var(--hub-subtle)', marginTop: '6px' }}>
                    {cardInfo.free < 0 ? `${formatCurrency(-cardInfo.free)} acima do limite` : `${formatCurrency(cardInfo.free)} de limite livre`}
                  </p>
                </>
              ) : (
                <Link to="/financeiro/configurar" className="mt-2 inline-block text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
                  informar o limite →
                </Link>
              )}
            </Card>
          ))}

          <Card>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '2px' }}>Atalhos</p>
            <ShortcutRow to={withMonthParam('/financeiro/gastos/relatorio', selectedMonth)} label="Relatório e análise do mês" />
            {reimbursementCount > 0 ? (
              <ShortcutRow to={withReimbursementsParams(selectedMonth)} label={`${reimbursementCount} reembolso${reimbursementCount === 1 ? '' : 's'} pareado${reimbursementCount === 1 ? '' : 's'}`} />
            ) : null}
            <ShortcutRow to={withMonthAndCategoryParams('/financeiro/gastos', selectedMonth)} label={`${summary.transactionCount} lançamento${summary.transactionCount === 1 ? '' : 's'} no mês`} />
            <ShortcutRow to="/financeiro/configurar/importar" label="Importar extrato" last />
          </Card>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ to, label, last = false }: { to: string; label: string; last?: boolean }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between text-sm transition-opacity hover:opacity-70"
      style={{ padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--hub-border)', color: 'var(--hub-text-body)' }}
    >
      <span>{label}</span>
      <span style={{ color: 'var(--hub-subtle)' }}>→</span>
    </Link>
  );
}

/** Month by month, how much was left — the current month last and in full color. */
function EvolutionList({ data }: { data: MonthlyEvolutionPoint[] }) {
  const lastIdx = data.length - 1;
  return (
    <div>
      {data.map((point, i) => {
        const isCurrent = i === lastIdx;
        const hasData = point.transactionCount > 0;
        return (
          <div
            key={point.month}
            className="flex items-baseline justify-between"
            style={{ padding: '8px 0', borderBottom: i < lastIdx ? '1px solid var(--hub-border)' : undefined }}
          >
            <span style={{ fontSize: '13px', color: isCurrent ? 'var(--hub-text)' : 'var(--hub-muted)', fontWeight: isCurrent ? 500 : 400 }}>
              {point.label}
            </span>
            <span
              className="tabular-nums"
              style={{
                fontSize: '13px',
                color: !hasData ? 'var(--hub-disabled)' : point.balance >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)',
              }}
            >
              {hasData ? `${point.balance >= 0 ? '+' : ''}${formatCurrency(point.balance)}` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
