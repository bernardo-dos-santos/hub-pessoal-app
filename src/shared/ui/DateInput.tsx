import { DateField } from './DateField';

type DateInputProps = {
  /** `YYYY-MM-DD` para `date`, `YYYY-MM` para `month`. String vazia = sem valor. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  type?: 'date' | 'month';
  placeholder?: string;
  /** Classes de layout (ex.: `w-full`). */
  className?: string;
};

/** `2026-10-06` → `06/10/2026`; `2026-10` → `10/2026`. Sem `Date`, para não andar um dia com o fuso. */
function formatValue(value: string): string {
  const [year, month, day] = value.split('-');
  return day ? `${day}/${month}/${year}` : `${month}/${year}`;
}

/**
 * Campo de data DE FORMULÁRIO: a mesma linha sublinhada de um `<input>` do
 * `@layer base`, com o seletor do `DateField` por trás.
 *
 * O `DateField` sozinho serve para rótulos soltos ("+ prazo", mês no
 * cabeçalho), onde quem usa decide a aparência. Num formulário, ao lado de
 * inputs de texto, o campo precisa parecer input — e escrever esse span em
 * cada formulário era repetir o mesmo markup em doze lugares.
 */
export function DateInput({
  value,
  onChange,
  ariaLabel,
  type = 'date',
  placeholder = 'Selecionar data',
  className,
}: DateInputProps) {
  return (
    <DateField value={value} onChange={onChange} type={type} ariaLabel={ariaLabel} className={`block${className ? ` ${className}` : ''}`}>
      <span
        className="hub-date-input block pb-1.5 text-sm tabular-nums"
        style={{ color: value ? 'var(--hub-text)' : 'var(--hub-disabled)' }}
      >
        {value ? formatValue(value) : placeholder}
      </span>
    </DateField>
  );
}
