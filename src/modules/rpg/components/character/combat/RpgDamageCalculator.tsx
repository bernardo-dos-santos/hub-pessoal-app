import { useState } from 'react';
import { RpgMetricCard } from '../RpgMetricCard';
import { type RpgCharacter, type RpgResourceId, type RpgRulesProfile } from '../../../types/rpg';
import { calculateDefense } from '../../../utils/rpgCalculations';

type RpgDamageCalculatorProps = {
  character: RpgCharacter;
  compact?: boolean;
  onResourceChange: (resourceId: RpgResourceId, current: number) => void;
  rulesProfile: RpgRulesProfile;
};

export function RpgDamageCalculator({ character, compact = false, onResourceChange, rulesProfile }: RpgDamageCalculatorProps) {
  const [incomingDamage, setIncomingDamage] = useState(0);
  const life = character.resources.find((resource) => resource.id === 'vida');
  const currentDefense = calculateDefense(character, rulesProfile);
  const damageCaused = Math.max(0, Math.round(incomingDamage - currentDefense));
  const hpAfterDamage = Math.max(0, Math.round((life?.current ?? 0) - damageCaused));

  return (
    <div className="grid gap-4 py-2">
      {compact ? (
        <div className="grid grid-cols-2 gap-4">
          <RpgMetricCard label="Defesa" value={currentDefense} />
          <RpgMetricCard label="HP Final" value={hpAfterDamage} />
        </div>
      ) : null}
      <label className="grid gap-2">
        <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-label)' }}>Dano recebido</span>
        <input
          className="h-10 text-lg tabular-nums"
          style={{ fontWeight: 300 }}
          type="number"
          value={incomingDamage}
          onChange={(event) => setIncomingDamage(Number(event.target.value))}
        />
      </label>
      {compact ? (
        <RpgMetricCard label="Dano causado" value={damageCaused} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <RpgMetricCard label="Dano causado" value={damageCaused} />
          <RpgMetricCard label="HP Final" value={hpAfterDamage} />
        </div>
      )}
      {!compact ? (
        <p className="text-xs leading-5" style={{ color: 'var(--hub-label)' }}>
          Fórmula: dano recebido − defesa atual. Se o resultado for menor que zero, nenhum dano passa.
        </p>
      ) : null}
      <button
        className="justify-self-start text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
        type="button"
        onClick={() => onResourceChange('vida', hpAfterDamage)}
      >
        Aplicar dano
      </button>
    </div>
  );
}
