import { type RpgAbility } from '../../types/rpg';
import { isFrioAmargoActiveTrackerBlocked } from '../../utils/rpgCombatModifiers';

type RpgTrackerListProps = {
  ability: RpgAbility;
  onTrackerChange: (abilityId: string, trackerId: string, used: number) => void;
};

export function RpgTrackerList({ ability, onTrackerChange }: RpgTrackerListProps) {
  return (
    <div className="grid gap-2">
      {ability.trackers.map((tracker) => (
        <div key={tracker.id} className="py-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--hub-text)' }}>{tracker.label}</span>
            <span className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>{tracker.used}/{tracker.max} {tracker.scope}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: tracker.max }).map((_, index) => {
              const isBlocked = isFrioAmargoActiveTrackerBlocked(ability, tracker.id);

              return (
                <button
                  key={`${tracker.id}-${index}`}
                  aria-label={`${tracker.label} ${index + 1}`}
                  className="h-4 w-4 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: index < tracker.used ? 'var(--hub-accent)' : 'var(--hub-border-strong)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  disabled={isBlocked}
                  title={isBlocked ? 'Sem usos restantes neste nivel' : undefined}
                  type="button"
                  onClick={() => onTrackerChange(ability.id, tracker.id, tracker.used === index + 1 ? index : index + 1)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
