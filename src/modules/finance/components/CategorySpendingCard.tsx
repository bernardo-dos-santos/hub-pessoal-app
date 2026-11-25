import { Link } from 'react-router-dom';
import { Card } from '../../../shared/ui';
import { budgetService } from '../services/budgetService';
import { financeSummaryService } from '../services/financeSummaryService';
import { transactionService } from '../services/transactionService';
import type { Budget } from '../types/budget';
import { formatCurrency } from '../utils/financeFormatters';
import { withMonthAndCategoryParams } from '../utils/financePeriod';

type CategorySpendingCardProps = {
  month: string;
  /** How many categories to show; the rest is summed as "outras". */
  limit?: number;
  /** Category currently filtered on (Gastos), drawn as selected. */
  selected?: string | null;
  /** Instead of linking to Gastos, select in place (Gastos itself). */
  onSelect?: (category: string) => void;
  footer?: { label: string; to: string };
};

/** The budget that covers exactly this one category, if any. */
function budgetFor(category: string, budgets: Budget[]) {
  return budgets.find((budget) =>
    budget.categories?.length ? budget.categories.length === 1 && budget.categories[0] === category : budget.category === category,
  );
}

/**
 * "Onde foi": the month's spending by category, biggest first, each bar against
 * its budget when there is one (red once it passes) and against the biggest
 * category otherwise. Shared by Resumo and Gastos, so both read the same numbers.
 */
export function CategorySpendingCard({ month, limit = 5, selected, onSelect, footer }: CategorySpendingCardProps) {
  const items = financeSummaryService
    .getCategoryExpenses(month)
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // "Gastei" counts what is still waiting in Revisar; the bars don't (it has no
  // category yet), so without this line the two never added up.
  const pendingReview = financeSummaryService.getFinanceSummary(month).pendingExpenseReview;

  if (items.length === 0 && pendingReview <= 0) {
    return (
      <Card>
        <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '8px' }}>
          Onde foi
        </p>
        <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Nenhum gasto neste mês.</p>
      </Card>
    );
  }

  const budgets = budgetService.listActiveBudgets();
  const transactions = transactionService.listTransactions();
  const shown = items.slice(0, limit);
  const rest = items.slice(limit).reduce((sum, item) => sum + item.amount, 0);
  const biggest = items[0]?.amount ?? 0;

  return (
    <Card>
      <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '8px' }}>
        Onde foi
      </p>
      {shown.map((item, index) => {
        const budget = budgetFor(item.category, budgets);
        const usage = budget ? budgetService.getBudgetUsage(budget, transactions, month) : null;
        const over = usage?.status === 'exceeded';
        const pct = Math.min(100, Math.round((item.amount / (budget ? budget.limit : biggest)) * 100));
        const isSelected = selected === item.category;
        const row = (
          <div style={{ padding: '10px 0', borderBottom: index === shown.length - 1 && rest === 0 && pendingReview <= 0 ? 'none' : '1px solid var(--hub-border)' }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm" style={{ color: isSelected ? 'var(--hub-accent)' : 'var(--hub-text-body)', fontWeight: isSelected ? 500 : 400 }}>
                {item.category}
              </span>
              <span className="shrink-0 text-sm tabular-nums" style={{ color: over ? 'var(--hub-negative)' : 'var(--hub-text-body)' }}>
                {formatCurrency(item.amount)}
                {budget ? (
                  <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}> de {formatCurrency(budget.limit)}</span>
                ) : null}
              </span>
            </div>
            <div style={{ height: '4px', marginTop: '7px', background: 'var(--hub-track)', borderRadius: 'var(--hub-radius-control)' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '4px',
                  borderRadius: 'var(--hub-radius-control)',
                  background: over ? 'var(--hub-negative)' : 'var(--hub-accent)',
                }}
              />
            </div>
          </div>
        );

        if (onSelect) {
          return (
            <button
              key={item.category}
              type="button"
              className="block w-full text-left transition-opacity hover:opacity-80"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              aria-pressed={isSelected}
              onClick={() => onSelect(item.category)}
            >
              {row}
            </button>
          );
        }
        return (
          <Link key={item.category} to={withMonthAndCategoryParams('/financeiro/gastos', month, item.category)} className="block transition-opacity hover:opacity-80">
            {row}
          </Link>
        );
      })}
      {rest > 0 ? (
        <div className="flex items-baseline justify-between" style={{ paddingTop: '10px' }}>
          <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>outras {items.length - shown.length}</span>
          <span className="text-sm tabular-nums" style={{ color: 'var(--hub-muted)' }}>{formatCurrency(rest)}</span>
        </div>
      ) : null}
      {pendingReview > 0 ? (
        <Link
          to={`/financeiro/revisao?month=${month}`}
          className="flex items-baseline justify-between transition-opacity hover:opacity-70"
          style={{ paddingTop: '10px' }}
        >
          <span className="text-sm" style={{ color: 'var(--hub-warning)' }}>a revisar</span>
          <span className="text-sm tabular-nums" style={{ color: 'var(--hub-warning)' }}>{formatCurrency(pendingReview)}</span>
        </Link>
      ) : null}
      {footer ? (
        <Link to={footer.to} className="mt-3 inline-block text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
          {footer.label} →
        </Link>
      ) : null}
    </Card>
  );
}
