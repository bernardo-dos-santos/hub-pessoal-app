import { DateField } from '../../../shared/ui';
import { getNextMonthKey, getPreviousMonthKey, formatMonthLabel } from '../utils/financePeriod';

type MonthSelectorProps = {
  value: string;
  onChange: (month: string) => void;
  size?: 'sm' | 'md';
};

export function MonthSelector({ value, onChange, size = 'md' }: MonthSelectorProps) {
  const textCls = size === 'sm' ? 'text-xs' : 'text-sm';
  const arrowCls = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-3">
      <button
        className={`${arrowCls} transition-opacity hover:opacity-70`}
        style={{ color: 'var(--hub-subtle)' }}
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(getPreviousMonthKey(value))}
      >
        ←
      </button>

      <DateField type="month" value={value} onChange={onChange} ariaLabel="Mês selecionado">
        <span className={`${textCls} font-medium capitalize transition-opacity hover:opacity-70`} style={{ color: 'var(--hub-text-body)' }}>
          {formatMonthLabel(value)}
        </span>
      </DateField>

      <button
        className={`${arrowCls} transition-opacity hover:opacity-70`}
        style={{ color: 'var(--hub-subtle)' }}
        type="button"
        aria-label="Próximo mês"
        onClick={() => onChange(getNextMonthKey(value))}
      >
        →
      </button>
    </div>
  );
}
