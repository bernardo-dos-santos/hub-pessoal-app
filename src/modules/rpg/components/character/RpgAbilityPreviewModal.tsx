import { type RpgAbilityPreview } from '../../types/rpg';

type RpgAbilityPreviewModalProps = {
  onApply: () => void;
  onClose: () => void;
  preview: RpgAbilityPreview;
};

const sectionLabelStyle = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'var(--hub-label)',
} as const;

export function RpgAbilityPreviewModal({ onApply, onClose, preview }: RpgAbilityPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end p-3 sm:place-items-center" style={{ background: 'rgba(58,44,34,0.35)' }}>
      <section
        className="grid max-h-[90vh] w-full max-w-lg gap-5 overflow-auto p-5"
        style={{
          background: 'var(--hub-card)',
          border: '1px solid var(--hub-border-strong)',
          backdropFilter: 'blur(8px)',
          color: 'var(--hub-text)',
        }}
      >
        <div>
          <h2 className="text-lg font-medium" style={{ color: 'var(--hub-text)' }}>Usar {preview.ability.title}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--hub-muted)' }}>Confira custos, usos e efeitos antes de aplicar.</p>
        </div>
        {preview.resourceChanges.length > 0 ? (
          <div className="grid gap-2">
            <h3 style={sectionLabelStyle}>Recursos</h3>
            {preview.resourceChanges.map((change) => (
              <p key={change.resourceId} className="py-1 text-sm tabular-nums" style={{ color: 'var(--hub-text-body)' }}>
                {change.label}: {change.current} − {change.cost} = <strong style={{ color: 'var(--hub-text)' }}>{change.next}</strong>
              </p>
            ))}
          </div>
        ) : null}
        {preview.trackers.length > 0 ? (
          <div className="grid gap-2">
            <h3 style={sectionLabelStyle}>Usos</h3>
            {preview.trackers.map((tracker) => (
              <p key={tracker.id} className="py-1 text-sm tabular-nums" style={{ color: 'var(--hub-text-body)' }}>
                {tracker.label}: {tracker.used}/{tracker.max} → <strong style={{ color: 'var(--hub-text)' }}>{tracker.nextUsed}/{tracker.max}</strong>
              </p>
            ))}
          </div>
        ) : null}
        {preview.effects.length > 0 ? (
          <div className="grid gap-2">
            <h3 style={sectionLabelStyle}>Efeitos ativos</h3>
            {preview.effects.map((effect) => (
              <p key={effect.id} className="py-1 text-sm" style={{ color: 'var(--hub-accent)' }}>{effect.label}: {effect.description}</p>
            ))}
          </div>
        ) : null}
        {preview.warnings.length > 0 ? (
          <div className="grid gap-1 text-sm" style={{ color: 'var(--hub-warning)' }}>
            {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        ) : null}
        <div className="flex items-baseline justify-end gap-6 pt-1">
          <button
            className="text-xs transition-opacity hover:opacity-60"
            style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            onClick={onApply}
          >
            Aplicar
          </button>
        </div>
      </section>
    </div>
  );
}
