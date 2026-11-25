import { Link } from 'react-router-dom';
import { formatMonthLabel, getCurrentMonthKey } from '../utils/financePeriod';

/**
 * Where the lines just imported are waiting for review. Revisar opens on the
 * current month (and its badge counts only that month), so a statement from an
 * earlier month would otherwise land out of sight with "tudo revisado" on screen.
 */
export function ImportReviewMonths({ months }: { months: string[] }) {
  if (months.length === 0) return null;
  const current = getCurrentMonthKey();

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
        Para revisar:
      </p>
      {months.map((month) => (
        <Link
          key={month}
          to={`/financeiro/revisao?month=${month}`}
          className="text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)' }}
        >
          {formatMonthLabel(month)}
          {month === current ? ' (este mês)' : ''} →
        </Link>
      ))}
    </div>
  );
}
