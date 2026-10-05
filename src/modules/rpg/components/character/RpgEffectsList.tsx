import { RpgPanel } from '../RpgPanel';
import { type RpgActiveEffect } from '../../types/rpg';

type RpgEffectsListProps = {
  effects: RpgActiveEffect[];
  onRemoveEffect: (effectId: string) => void;
};

export function RpgEffectsList({ effects, onRemoveEffect }: RpgEffectsListProps) {
  if (effects.length === 0) {
    return (
      <RpgPanel title="Efeitos ativos" defaultOpen={false}>
        <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Nenhum efeito ativo no momento.</p>
      </RpgPanel>
    );
  }

  return (
    <RpgPanel title="Efeitos ativos" meta={`${effects.length}`}>
      {effects.map((effect) => (
        <article key={effect.id} className="py-2" style={{ borderBottom: '1px solid var(--hub-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium" style={{ color: 'var(--hub-accent)' }}>{effect.title}</h3>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{effect.description}</p>
              <p className="mt-1 text-xs uppercase" style={{ letterSpacing: '0.1em', color: 'var(--hub-label)' }}>{effect.duration}</p>
            </div>
            <button
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
              onClick={() => onRemoveEffect(effect.id)}
            >
              Remover
            </button>
          </div>
        </article>
      ))}
    </RpgPanel>
  );
}
