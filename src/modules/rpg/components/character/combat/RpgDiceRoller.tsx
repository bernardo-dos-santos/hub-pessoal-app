import { useState } from 'react';
import { rpgSessionLogService } from '../../../services/rpgSessionLogService';

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;
type DiceType = (typeof DICE_TYPES)[number];

type RollResult = {
  die: DiceType;
  value: number;
  modifier: number;
  total: number;
  timestamp: string;
};

function rollDie(sides: DiceType): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function RpgDiceRoller() {
  const [selectedDie, setSelectedDie] = useState<DiceType>(20);
  const [modifier, setModifier] = useState(0);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);

  function handleRoll() {
    const value = rollDie(selectedDie);
    const total = value + modifier;
    const result: RollResult = {
      die: selectedDie,
      value,
      modifier,
      total,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setLastRoll(result);
    setHistory((prev) => [result, ...prev].slice(0, 10));

    const modStr = modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''}${modifier}` : '';
    rpgSessionLogService.addEntry(`🎲 d${selectedDie}${modStr} → ${total} (${value})`, 'dice');
  }

  const isCritical = lastRoll?.die === 20 && lastRoll.value === 20;
  const isFumble = lastRoll?.die === 20 && lastRoll.value === 1;
  const resultColor = isCritical ? 'var(--hub-warning)' : isFumble ? 'var(--hub-negative)' : 'var(--hub-text)';

  return (
    <div className="space-y-5">
      {/* Seletor de dado */}
      <div>
        <p className="mb-2 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Tipo de dado</p>
        <div className="flex flex-wrap gap-1">
          {DICE_TYPES.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDie(d)}
              className={`hub-tab${selectedDie === d ? ' active' : ''}`}
              type="button"
            >
              d{d}
            </button>
          ))}
        </div>
      </div>

      {/* Modificador */}
      <div className="flex items-center gap-3">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Modificador</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModifier((m) => m - 1)}
            className="grid h-7 w-7 place-items-center transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-sm font-medium tabular-nums" style={{ color: modifier >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)' }}>
            {modifier >= 0 ? '+' : ''}{modifier}
          </span>
          <button
            onClick={() => setModifier((m) => m + 1)}
            className="grid h-7 w-7 place-items-center transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
            type="button"
          >
            +
          </button>
          {modifier !== 0 && (
            <button
              onClick={() => setModifier(0)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-label)', background: 'none', border: 'none', cursor: 'pointer' }}
              type="button"
            >
              reset
            </button>
          )}
        </div>
      </div>

      {/* Botão de rolar */}
      <button
        onClick={handleRoll}
        className="text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        type="button"
      >
        🎲 Rolar d{selectedDie}{modifier !== 0 ? ` ${modifier >= 0 ? '+' : ''}${modifier}` : ''}
      </button>

      {/* Resultado */}
      {lastRoll && (
        <div className="py-3 text-center" style={{ borderTop: '1px solid var(--hub-border)', borderBottom: '1px solid var(--hub-border)' }}>
          {isCritical && <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--hub-warning)' }}>Crítico!</p>}
          {isFumble && <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--hub-negative)' }}>Fumble!</p>}
          <p className="text-4xl tabular-nums" style={{ fontWeight: 300, letterSpacing: '-0.02em', color: resultColor }}>
            {lastRoll.total}
          </p>
          <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
            d{lastRoll.die}: {lastRoll.value}
            {lastRoll.modifier !== 0 && ` ${lastRoll.modifier >= 0 ? '+' : ''}${lastRoll.modifier}`}
          </p>
        </div>
      )}

      {/* Histórico da sessão (só em memória) */}
      {history.length > 1 && (
        <div>
          <p className="mb-1.5 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-label)' }}>Histórico desta sessão</p>
          <div>
            {history.slice(1).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                <span className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>d{r.die}{r.modifier !== 0 ? ` ${r.modifier >= 0 ? '+' : ''}${r.modifier}` : ''}</span>
                <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--hub-text)' }}>{r.total}</span>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{r.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
