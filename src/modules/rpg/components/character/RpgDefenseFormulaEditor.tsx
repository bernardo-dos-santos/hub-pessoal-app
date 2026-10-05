import { RpgPanel } from '../RpgPanel';
import { type RpgRulesProfile } from '../../types/rpg';
import { type RpgFormulaVariables, evaluateFormula } from '../../utils/rpgFormula';

type RpgDefenseFormulaEditorProps = {
  onChange: (updates: Partial<RpgRulesProfile>) => void;
  rulesProfile: RpgRulesProfile;
  variables: RpgFormulaVariables;
};

export function RpgDefenseFormulaEditor({ onChange, rulesProfile, variables }: RpgDefenseFormulaEditorProps) {
  const result = evaluateFormula(rulesProfile.defenseFormula, variables);
  const roundedResult = result.ok ? Math.round(result.value) : null;
  const variableList = Object.keys(variables).sort().join(', ');

  return (
    <RpgPanel defaultOpen={false} title="Formula da Defesa" meta={roundedResult !== null ? `Atual: ${roundedResult}` : 'Invalida'}>
      <label className="grid gap-2">
        <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-label)' }}>Expressao</span>
        <textarea
          className="min-h-32 font-mono text-xs leading-5"
          value={rulesProfile.defenseFormula}
          onChange={(event) => onChange({ defenseFormula: event.target.value })}
        />
      </label>
      <label className="grid gap-2">
        <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-label)' }}>Nota</span>
        <textarea
          className="min-h-20 text-xs leading-5"
          value={rulesProfile.defenseFormulaNote}
          onChange={(event) => onChange({ defenseFormulaNote: event.target.value })}
        />
      </label>
      <p className="text-xs leading-5" style={{ color: result.ok ? 'var(--hub-positive)' : 'var(--hub-negative)' }}>
        {roundedResult !== null ? `Resultado com a ficha atual: ${roundedResult}` : result.error}
      </p>
      <p className="text-xs leading-5" style={{ color: 'var(--hub-label)' }}>
        Variaveis: {variableList}. Comparacoes como <code>vida &gt; 193</code> viram 1 ou 0.
      </p>
    </RpgPanel>
  );
}
