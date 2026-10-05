import { Card } from '../../../../../shared/ui';
import { RpgPanel } from '../../RpgPanel';
import { RpgResourceCard } from '../../RpgResourceCard';
import { RpgDamageCalculator } from '../combat/RpgDamageCalculator';
import { RpgDiceRoller } from '../combat/RpgDiceRoller';
import { RpgWeaponList } from '../combat/RpgWeaponList';
import { RpgDefenseFormulaEditor } from '../RpgDefenseFormulaEditor';
import { RpgMetricCard } from '../RpgMetricCard';
import { RpgSessionLog } from '../RpgSessionLog';
import { type RpgCharacter, type RpgResourceId, type RpgRulesProfile } from '../../../types/rpg';
import { calculateDefense } from '../../../utils/rpgCalculations';
import { type RpgFormulaVariables } from '../../../utils/rpgFormula';

type RpgCombatTabProps = {
  character: RpgCharacter;
  onResourceChange: (resourceId: RpgResourceId, current: number) => void;
  onResourceMaxChange: (resourceId: RpgResourceId, max: number) => void;
  onRulesProfileChange: (updates: Partial<RpgRulesProfile>) => void;
  rulesProfile: RpgRulesProfile;
  variables: RpgFormulaVariables;
};

export function RpgCombatTab({
  character,
  onResourceChange,
  onResourceMaxChange,
  onRulesProfileChange,
  rulesProfile,
  variables,
}: RpgCombatTabProps) {
  const life = character.resources.find((resource) => resource.id === 'vida');
  const currentDefense = calculateDefense(character, rulesProfile);

  return (
    <>
      <Card>
        <div className="grid gap-3">
          {life ? <RpgResourceCard resource={life} onChange={(nextValue) => onResourceChange('vida', nextValue)} onMaxChange={(nextValue) => onResourceMaxChange('vida', nextValue)} /> : null}
          <RpgMetricCard label="Defesa" value={currentDefense} />
          <RpgDefenseFormulaEditor rulesProfile={rulesProfile} variables={variables} onChange={onRulesProfileChange} />
        </div>
      </Card>
      <RpgPanel title="Calcular Dano">
        <RpgDamageCalculator character={character} rulesProfile={rulesProfile} onResourceChange={onResourceChange} />
      </RpgPanel>
      <RpgPanel title="Armas">
        <RpgWeaponList character={character} variables={variables} />
      </RpgPanel>
      <RpgPanel title="Rolador de Dados">
        <RpgDiceRoller />
      </RpgPanel>
      <RpgPanel title="Log da Sessão">
        <RpgSessionLog character={character} onResourceChange={onResourceChange} />
      </RpgPanel>
    </>
  );
}
