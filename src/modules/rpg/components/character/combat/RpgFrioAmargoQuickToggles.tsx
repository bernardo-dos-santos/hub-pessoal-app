import { type RpgCharacter } from '../../../types/rpg';
import { getFrioAmargoActiveLevels } from '../../../utils/rpgCombatModifiers';

type RpgFrioAmargoQuickTogglesProps = {
  character: RpgCharacter;
  onTrackerChange: (abilityId: string, trackerId: string, used: number) => void;
};

export function RpgFrioAmargoQuickToggles({ character, onTrackerChange }: RpgFrioAmargoQuickTogglesProps) {
  const activeLevels = getFrioAmargoActiveLevels(character);

  return (
    <div className="grid gap-2 py-2">
      <h3 className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Frio Amargo ativo</h3>
      <div className="flex flex-wrap gap-4">
        {activeLevels.map((item) => (
          <button
            key={item.trackerId}
            className="py-1 text-xs font-medium transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              color: item.active ? 'var(--hub-positive)' : 'var(--hub-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderBottom: item.active ? '1px solid color-mix(in srgb, var(--hub-positive) 55%, transparent)' : '1px solid transparent',
            }}
            disabled={!item.active && item.exhausted}
            title={item.exhausted ? `Nivel ${item.level} sem usos restantes` : `Usos: ${item.used}/${item.max}`}
            type="button"
            onClick={() => onTrackerChange('frio-amargo', item.trackerId, item.active ? 0 : 1)}
          >
            Nível {item.level}
          </button>
        ))}
      </div>
    </div>
  );
}
