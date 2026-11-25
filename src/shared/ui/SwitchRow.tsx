import { type ReactNode } from 'react';

type SwitchRowProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The setting's name. */
  label: ReactNode;
  /** One sentence on what it does — shown under the label. */
  description?: ReactNode;
  /** Something before the label (e.g. the module's sigla in ModulePicker). */
  leading?: ReactNode;
  last?: boolean;
};

/**
 * A setting that is on or off: the whole row is the switch (role="switch"), so
 * the touch target is the row, not a 36px knob. Rows inside a card are divided
 * like ListRow's.
 */
export function SwitchRow({ checked, onChange, label, description, leading, last }: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-80"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--hub-border)',
      }}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium" style={{ color: checked ? 'var(--hub-text)' : 'var(--hub-muted)' }}>
          {label}
        </span>
        {description && (
          <span className="block text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{description}</span>
        )}
      </span>
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 transition-colors"
        style={{ borderRadius: 'var(--hub-radius-control)', background: checked ? 'var(--hub-accent)' : 'var(--hub-track)' }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 transition-all"
          style={{
            left: checked ? '18px' : '2px',
            borderRadius: 'var(--hub-radius-control)',
            background: checked ? 'var(--hub-on-accent)' : 'var(--hub-card)',
            boxShadow: 'var(--hub-shadow-card)',
          }}
        />
      </span>
    </button>
  );
}
