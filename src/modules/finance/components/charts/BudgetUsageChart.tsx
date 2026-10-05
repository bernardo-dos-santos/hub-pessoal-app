import { type Budget } from '../../types/budget';
import { formatCurrency, formatPercentage } from '../../utils/financeFormatters';
import { FinanceChartEmptyState } from './FinanceChartCard';

export type BudgetUsageChartItem = {
  budget: Budget;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: 'ok' | 'attention' | 'exceeded';
  transactionsCount: number;
};

type BudgetUsageChartProps = {
  items: BudgetUsageChartItem[];
};

const statusColor: Record<BudgetUsageChartItem['status'], string> = {
  attention: 'var(--hub-warning)',
  exceeded: 'var(--hub-negative)',
  ok: 'var(--hub-positive)',
};

const statusLabel: Record<BudgetUsageChartItem['status'], string> = {
  attention: 'Em atenção',
  exceeded: 'Excedido',
  ok: 'Dentro do limite',
};

export function BudgetUsageChart({ items }: BudgetUsageChartProps) {
  if (items.length === 0) {
    return <FinanceChartEmptyState>Nenhum orçamento ativo para este mês.</FinanceChartEmptyState>;
  }

  return (
    <div aria-label="Uso dos orçamentos">
      {items.map((item) => {
        const percent = Math.max(item.percentUsed, 0);
        const width = Math.min(percent, 100);
        const color = statusColor[item.status];

        return (
          <article
            key={item.budget.id}
            style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: '1px solid var(--hub-border)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2" style={{ marginBottom: '10px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--hub-text)' }}>{item.budget.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '3px' }}>
                  {item.budget.category} · {item.budget.scope}
                </p>
              </div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color }}>
                {statusLabel[item.status]}
              </span>
            </div>

            <div className="mb-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${width}%`, background: color }}
                aria-hidden="true"
              />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>
                <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 300, color }}>
                  {formatCurrency(item.spent)}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                  {' '}de {formatCurrency(item.budget.limit)}
                </span>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>{formatPercentage(percent)}</span>
              <span style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                {item.transactionsCount} transação{item.transactionsCount === 1 ? '' : 'ões'}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
