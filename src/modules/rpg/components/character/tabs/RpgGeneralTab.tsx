import { Card } from '../../../../../shared/ui';
import { RpgResourceCard } from '../../RpgResourceCard';
import { RpgCombatModePanel } from './RpgCombatModePanel';
import { RpgDefenseFormulaEditor } from '../RpgDefenseFormulaEditor';
import { RpgEffectsList } from '../RpgEffectsList';
import { RpgMetricCard } from '../RpgMetricCard';
import { type RpgCharacter, type RpgResourceId, type RpgRulesProfile } from '../../../types/rpg';
import { calculateDefense } from '../../../utils/rpgCalculations';
import { type RpgFormulaVariables } from '../../../utils/rpgFormula';

type RpgGeneralTabProps = {
  character: RpgCharacter;
  combatModeEnabled: boolean;
  onChange: (updates: Partial<RpgCharacter>) => void;
  onRemoveEffect: (effectId: string) => void;
  onResourceChange: (resourceId: RpgResourceId, current: number) => void;
  onResourceMaxChange: (resourceId: RpgResourceId, max: number) => void;
  onRulesProfileChange: (updates: Partial<RpgRulesProfile>) => void;
  onToggleCombatMode: () => void;
  onTrackerChange: (abilityId: string, trackerId: string, used: number) => void;
  reviewCount: number;
  rulesProfile: RpgRulesProfile;
  variables: RpgFormulaVariables;
};

export function RpgGeneralTab({
  character,
  combatModeEnabled,
  onChange,
  onRemoveEffect,
  onResourceChange,
  onResourceMaxChange,
  onRulesProfileChange,
  onToggleCombatMode,
  onTrackerChange,
  reviewCount,
  rulesProfile,
  variables,
}: RpgGeneralTabProps) {
  const defense = calculateDefense(character, rulesProfile);

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-medium" style={{ color: 'var(--hub-text)' }}>Painel rapido</h2>
            <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>Atalhos para momentos de combate.</p>
          </div>
          <button
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: combatModeEnabled ? 'var(--hub-positive)' : 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
            onClick={onToggleCombatMode}
          >
            {combatModeEnabled ? '● Modo Combate ativo' : 'Modo Combate'}
          </button>
        </div>
        {combatModeEnabled ? (
          <div className="mt-3">
            <RpgCombatModePanel character={character} rulesProfile={rulesProfile} variables={variables} onResourceChange={onResourceChange} onTrackerChange={onTrackerChange} />
          </div>
        ) : null}
      </Card>
      <Card>
        <div className="grid gap-3">
          {character.resources.map((resource) => (
            <RpgResourceCard key={resource.id} resource={resource} onChange={(nextValue) => onResourceChange(resource.id, nextValue)} onMaxChange={(nextValue) => onResourceMaxChange(resource.id, nextValue)} />
          ))}
        </div>
      </Card>
      <Card>
        <div className="grid gap-4">
          <RpgMetricCard label="Defesa" value={defense} />
          <p className="text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>
            {rulesProfile.defenseFormulaNote}
          </p>
          <RpgDefenseFormulaEditor rulesProfile={rulesProfile} variables={variables} onChange={onRulesProfileChange} />
          <label className="grid gap-2">
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-label)' }}>Bonus de Defesa Temporario</span>
            <input
              className="h-10 w-24 text-xl tabular-nums"
              style={{ fontWeight: 300 }}
              type="number"
              value={character.temporaryDefenseBonus}
              onChange={(event) => onChange({ temporaryDefenseBonus: Number(event.target.value) })}
            />
          </label>
          <RpgMetricCard label="Revisoes pendentes" value={reviewCount} />
        </div>
      </Card>
      <RpgEffectsList effects={character.activeEffects} onRemoveEffect={onRemoveEffect} />
    </>
  );
}
