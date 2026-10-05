import { type TafTestResult } from '../services/tafService';
import { Card, ProgressBar, HeroValue, type Signal } from '../../../shared/ui';

const statusMeta: Record<string, { signal: Signal; color: string; label: string }> = {
  above: { signal: 'positive', color: 'var(--hub-positive)', label: 'Aprovado ✓' },
  close: { signal: 'warning',  color: 'var(--hub-warning)',  label: 'Em atenção' },
  below: { signal: 'negative', color: 'var(--hub-negative)', label: 'Abaixo' },
};

const noData = { signal: 'neutral' as Signal, color: 'var(--hub-muted)', label: 'Sem dados' };

function valueLabel(result: TafTestResult): string {
  if (result.bestValue === null) return '—';
  return result.requirement.workoutType === 'running'
    ? `${result.bestValue} m`
    : `${result.bestValue}`;
}

function minimumLabel(result: TafTestResult): string {
  return result.requirement.workoutType === 'running'
    ? `${result.requirement.minimumValue} m`
    : `${result.requirement.minimumValue}`;
}

export function TafStatusCard({ result }: { result: TafTestResult }) {
  const meta = result.status ? statusMeta[result.status] : noData;
  const pct =
    result.bestValue !== null
      ? Math.min(100, Math.round((result.bestValue / result.requirement.minimumValue) * 100))
      : 0;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{result.requirement.testName}</p>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>

      <div className="mb-3 flex items-end justify-between">
        <HeroValue size={30} color={meta.color}>{valueLabel(result)}</HeroValue>
        <span className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
          meta {minimumLabel(result)}
        </span>
      </div>

      <ProgressBar value={pct} percent signal={meta.signal} height={6} />

      {result.gap !== null && result.gap > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--hub-muted)' }}>
          Faltam{' '}
          <span className="font-medium" style={{ color: 'var(--hub-text)' }}>
            {result.requirement.workoutType === 'running' ? `${result.gap} m` : `${result.gap} reps`}
          </span>
        </p>
      )}
    </Card>
  );
}
