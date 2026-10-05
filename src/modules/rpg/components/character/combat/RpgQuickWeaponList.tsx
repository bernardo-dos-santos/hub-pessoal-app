import { RpgFormulaChip } from '../../RpgFormulaChip';
import { type RpgCharacter } from '../../../types/rpg';
import { applyRpgDamageModifiers } from '../../../utils/rpgCombatModifiers';
import { type RpgFormulaVariables } from '../../../utils/rpgFormula';

type RpgQuickWeaponListProps = {
  character: RpgCharacter;
  variables: RpgFormulaVariables;
};

export function RpgQuickWeaponList({ character, variables }: RpgQuickWeaponListProps) {
  return (
    <div className="grid min-w-0 gap-2 py-2">
      <h3 className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Ataques principais</h3>
      {character.weapons.map((weapon) => (
        <div key={weapon.id} className="grid min-w-0 gap-1">
          <span className="text-xs" style={{ color: 'var(--hub-muted)' }}>{weapon.name}</span>
          <div className="grid min-w-0 gap-2">
            <RpgFormulaChip expression={applyRpgDamageModifiers(weapon.damageFormula, character)} label="Normal" variables={variables} />
            <RpgFormulaChip expression={applyRpgDamageModifiers(weapon.criticalFormula, character)} label="Critico" variables={variables} />
          </div>
        </div>
      ))}
    </div>
  );
}
