import { RpgFormulaChip } from '../../RpgFormulaChip';
import { type RpgCharacter } from '../../../types/rpg';
import { applyRpgDamageModifiers } from '../../../utils/rpgCombatModifiers';
import { evaluateFormula, type RpgFormulaVariables } from '../../../utils/rpgFormula';

type RpgWeaponListProps = {
  character: RpgCharacter;
  variables: RpgFormulaVariables;
};

export function RpgWeaponList({ character, variables }: RpgWeaponListProps) {
  return (
    <div className="grid gap-3">
      {character.weapons.map((weapon) => {
        const damageFormula = applyRpgDamageModifiers(weapon.damageFormula, character);
        const criticalFormula = applyRpgDamageModifiers(weapon.criticalFormula, character);
        const damage = evaluateFormula(damageFormula, variables);
        const critical = evaluateFormula(criticalFormula, variables);

        return (
          <article key={weapon.id} className="grid gap-2 py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
            <div>
              <h3 className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{weapon.name}</h3>
              <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>{weapon.range}{weapon.needsReview ? ' / revisar' : ''}</p>
            </div>
            <div className="grid min-w-0 gap-1">
              <RpgFormulaChip expression={damageFormula} label="Normal" variables={variables} />
              <RpgFormulaChip expression={criticalFormula} label="Critico" variables={variables} />
            </div>
            <p className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>Media normal {damage.ok ? damage.value : '-'} / media critica {critical.ok ? critical.value : '-'}</p>
          </article>
        );
      })}
    </div>
  );
}
