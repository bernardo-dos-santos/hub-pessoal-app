import { DateField } from '../../../shared/ui';
import { getCurrentMonthKey, getNextMonthKey, getPreviousMonthKey, formatMonthLabel, formatMonthRange } from '../utils/financePeriod';

type MonthSelectorProps = {
  value: string;
  onChange: (month: string) => void;
  size?: 'sm' | 'md';
};

export function MonthSelector({ value, onChange, size = 'md' }: MonthSelectorProps) {
  const textCls = size === 'sm' ? 'text-xs' : 'text-sm';
  const range = formatMonthRange(value);
  const label = formatMonthLabel(value);
  const currentMonth = getCurrentMonthKey();

  // The arrows were a bare glyph (~10×16px): a 36px square is a thumb's target.
  const arrowCls = `flex h-9 w-9 items-center justify-center ${textCls} transition-opacity hover:opacity-70`;

  return (
    <div className="flex items-center gap-1">
      <button
        className={arrowCls}
        style={{ color: 'var(--hub-subtle)' }}
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(getPreviousMonthKey(value))}
      >
        ←
      </button>

      <DateField type="month" value={value} onChange={onChange} ariaLabel="Mês selecionado">
        <span className="flex flex-col items-center leading-tight">
          <span className={`${textCls} font-medium transition-opacity hover:opacity-70`} style={{ color: 'var(--hub-text-body)' }}>
            {label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)}
          </span>
          {/* With a custom start day the name alone doesn't say which days count. */}
          {range && (
            <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
              {range}
            </span>
          )}
        </span>
      </DateField>

      <button
        className={arrowCls}
        style={{ color: 'var(--hub-subtle)' }}
        type="button"
        aria-label="Próximo mês"
        onClick={() => onChange(getNextMonthKey(value))}
      >
        →
      </button>

      {/* Six months back, the way home was six taps. */}
      {value !== currentMonth ? (
        <button
          className={`h-9 px-1 ${textCls} transition-opacity hover:opacity-70`}
          style={{ color: 'var(--hub-accent)' }}
          type="button"
          onClick={() => onChange(currentMonth)}
        >
          hoje
        </button>
      ) : null}
    </div>
  );
}
