type ChoiceCardProps = {
  active: boolean;
  title: string;
  description?: string;
  onClick: () => void;
};

/**
 * One of a few mutually exclusive options shown side by side ("Manual" vs
 * "Automático", "IFSC" vs "UNIPLAC" vs "Outra") — bigger than a radio because
 * each option needs a sentence explaining what choosing it means.
 */
export function ChoiceCard({ active, title, description, onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-1 p-4 text-left transition-opacity hover:opacity-90"
      style={{
        background: active ? 'var(--hub-surface-muted)' : 'transparent',
        border: `1px solid ${active ? 'var(--hub-accent)' : 'var(--hub-border-strong)'}`,
        borderRadius: 'var(--hub-radius-card)',
        cursor: 'pointer',
      }}
    >
      <span className="block text-sm font-medium" style={{ color: active ? 'var(--hub-accent)' : 'var(--hub-text)' }}>{title}</span>
      {description && <span className="mt-1 block text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{description}</span>}
    </button>
  );
}
