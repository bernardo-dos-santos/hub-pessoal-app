type MasteryRowProps = {
  label: string;
  /** 0–100. */
  score: number;
  trend?: 'up' | 'down' | 'stable';
  /** Texto à direita do rótulo (ex.: "12 questões"). */
  detail?: string;
};

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--hub-positive)';
  if (score >= 45) return 'var(--hub-warning)';
  return 'var(--hub-negative)';
}

const TREND_MARK: Record<'up' | 'down' | 'stable', string> = { up: '↑', down: '↓', stable: '' };

/**
 * Barra de domínio de uma matéria.
 *
 * Havia três implementações independentes da mesma barra, com três escalas de
 * cor levemente diferentes, em telas diferentes. Esta é a única — e agora só
 * aparece onde há o que fazer com a informação (a tela da disciplina), em vez de
 * espalhada por quatro telas onde era decoração.
 */
export function MasteryRow({ label, score, trend, detail }: MasteryRowProps) {
  return (
    <div className="py-2.5" style={{ borderBottom: '1px solid var(--hub-border)' }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm" style={{ color: 'var(--hub-text-body)' }}>{label}</span>
        <span className="shrink-0 text-xs tabular-nums" style={{ color: scoreColor(score) }}>
          {score}%{trend && TREND_MARK[trend] && <span style={{ marginLeft: '3px' }}>{TREND_MARK[trend]}</span>}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: scoreColor(score) }} />
      </div>
      {detail && (
        <p className="mt-1 text-[11px]" style={{ color: 'var(--hub-subtle)' }}>{detail}</p>
      )}
    </div>
  );
}
