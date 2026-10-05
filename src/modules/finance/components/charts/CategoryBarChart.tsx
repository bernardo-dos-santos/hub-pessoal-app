import { formatCurrency, formatPercentage } from '../../utils/financeFormatters';
import { FinanceChartEmptyState } from './FinanceChartCard';

export type CategoryBarChartItem = {
  category: string;
  amount: number;
  transactionsCount?: number;
  href?: string;
};

type CategoryBarChartProps = {
  items: CategoryBarChartItem[];
};

export function CategoryBarChart({ items }: CategoryBarChartProps) {
  const positiveItems = items.filter((item) => item.amount > 0);
  const total = positiveItems.reduce((sum, item) => sum + item.amount, 0);

  if (positiveItems.length === 0 || total <= 0) {
    return <FinanceChartEmptyState>Nenhum gasto encontrado para este mês.</FinanceChartEmptyState>;
  }

  // Finance palette: mint, indigo, coral and muted variants
  const barPalette = [
    'var(--hub-positive)',
    'var(--hub-accent)',
    'var(--hub-negative)',
    'color-mix(in srgb, var(--hub-positive) 60%, transparent)',
    'color-mix(in srgb, var(--hub-accent) 60%, transparent)',
    'color-mix(in srgb, var(--hub-negative) 60%, transparent)',
  ];

  return (
    <div aria-label="Gastos por categoria do mês">
      {positiveItems.map((item, index) => {
        const percent = (item.amount / total) * 100;
        const barColor = barPalette[index % barPalette.length];
        const rowStyle: React.CSSProperties = {
          paddingTop: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--hub-border)',
          display: 'block',
        };

        const content = (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong className="min-w-0 text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{item.category}</strong>
              <span className="text-sm tabular-nums" style={{ fontWeight: 300, color: 'var(--hub-text)' }}>{formatCurrency(item.amount)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(percent, 2)}%`, background: barColor }}
                  aria-hidden="true"
                />
              </div>
              <span className="w-11 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                {formatPercentage(percent)}
              </span>
            </div>
            <span className="mt-0.5 block text-xs" style={{ color: 'var(--hub-subtle)' }}>
              {item.transactionsCount ?? 0} transação{item.transactionsCount === 1 ? '' : 'ões'}
            </span>
          </>
        );

        return item.href ? (
          <a
            key={item.category}
            href={item.href}
            style={rowStyle}
            className="transition-opacity hover:opacity-75"
          >
            {content}
          </a>
        ) : (
          <article key={item.category} style={rowStyle}>
            {content}
          </article>
        );
      })}
    </div>
  );
}
