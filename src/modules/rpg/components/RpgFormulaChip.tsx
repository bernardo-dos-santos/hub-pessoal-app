import { useState } from 'react';
import { type RpgFormulaVariables, evaluateFormula, rollFormula } from '../utils/rpgFormula';

type RpgFormulaChipProps = {
  expression: string;
  label?: string;
  variables: RpgFormulaVariables;
};

export function RpgFormulaChip({ expression, label, variables }: RpgFormulaChipProps) {
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const average = evaluateFormula(expression, variables);

  function rollExpression() {
    const result = rollFormula(expression, variables);
    setLastRoll(result.ok ? result.value : null);
  }

  return (
    <button
      className="inline-flex min-h-8 w-full min-w-0 max-w-full items-center gap-2 py-1 text-left text-sm transition-opacity hover:opacity-70"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      title={average.ok ? `Media: ${average.value}` : average.error}
      type="button"
      onClick={rollExpression}
    >
      {label ? <span className="shrink-0 text-xs" style={{ color: 'var(--hub-subtle)' }}>{label}:</span> : null}
      <code className="min-w-0 flex-1 truncate font-medium" style={{ color: 'var(--hub-accent)' }}>{expression}</code>
      {lastRoll !== null ? (
        <span className="shrink-0 font-medium tabular-nums" style={{ color: 'var(--hub-positive)' }}>{lastRoll}</span>
      ) : null}
    </button>
  );
}
