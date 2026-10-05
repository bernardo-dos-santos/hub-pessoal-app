import { RpgDamageCalculator } from '../combat/RpgDamageCalculator';
import { RpgFrioAmargoQuickToggles } from '../combat/RpgFrioAmargoQuickToggles';
import { RpgQuickWeaponList } from '../combat/RpgQuickWeaponList';
import { type RpgCharacter, type RpgResourceId, type RpgRulesProfile } from '../../../types/rpg';
import { type RpgFormulaVariables } from '../../../utils/rpgFormula';

type RpgCombatModePanelProps = {
  character: RpgCharacter;
  onResourceChange: (resourceId: RpgResourceId, current: number) => void;
  onTrackerChange: (abilityId: string, trackerId: string, used: number) => void;
  rulesProfile: RpgRulesProfile;
  variables: RpgFormulaVariables;
};

export function RpgCombatModePanel({
  character,
  onResourceChange,
  onTrackerChange,
  rulesProfile,
  variables,
}: RpgCombatModePanelProps) {
  return (
    <div className="grid gap-3">
      <RpgFrioAmargoQuickToggles character={character} onTrackerChange={onTrackerChange} />
      <RpgDamageCalculator compact character={character} rulesProfile={rulesProfile} onResourceChange={onResourceChange} />
      <RpgQuickWeaponList character={character} variables={variables} />
    </div>
  );
}
