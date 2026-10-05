import { type RpgResource } from '../types/rpg';

type RpgResourceCardProps = {
  resource: RpgResource;
  onChange: (nextValue: number) => void;
  onMaxChange?: (nextValue: number) => void;
};

const colorValues: Record<string, string> = {
  emerald: 'var(--hub-positive)',
  fuchsia: '#C084FC',
  rose: 'var(--hub-negative)',
};

export function RpgResourceCard({ onChange, onMaxChange, resource }: RpgResourceCardProps) {
  const percentage = resource.max > 0 ? Math.max(0, Math.min(100, (resource.current / resource.max) * 100)) : 0;
  const accent = colorValues[resource.color] ?? 'var(--hub-accent)';

  return (
    <article className="py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{resource.label}</h3>
      </div>
      <div className="mb-3 h-0.5 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: accent, opacity: 0.7 }} />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2">
        <button
          className="grid h-10 w-10 place-items-center text-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
          type="button"
          onClick={() => onChange(resource.current - 1)}
        >
          −
        </button>
        <input
          className="h-10 min-w-0 text-center text-lg tabular-nums"
          style={{ fontWeight: 300 }}
          type="number"
          value={resource.current}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span style={{ color: 'var(--hub-subtle)' }}>/</span>
        {onMaxChange ? (
          <input
            className="h-10 min-w-0 text-center text-lg tabular-nums"
            style={{ fontWeight: 300 }}
            type="number"
            value={resource.max}
            onChange={(event) => onMaxChange(Number(event.target.value))}
          />
        ) : (
          <span className="grid h-10 min-w-0 place-items-center px-2 text-lg tabular-nums" style={{ color: 'var(--hub-text)', fontWeight: 300 }}>{resource.max}</span>
        )}
        <button
          className="grid h-10 w-10 place-items-center text-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
          type="button"
          onClick={() => onChange(resource.current + 1)}
        >
          +
        </button>
      </div>
      {resource.note ? <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-muted)' }}>{resource.note}</p> : null}
    </article>
  );
}
