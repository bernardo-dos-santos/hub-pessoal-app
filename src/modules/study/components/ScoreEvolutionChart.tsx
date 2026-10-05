import type { SimuladoResult } from '../types/simulado';

/**
 * Evolução do acerto nos últimos simulados.
 *
 * Veio da `SimuladoHistoryPage`, que foi fundida na aba Simulados. As cores
 * eram hex soltos herdados do tema escuro anterior (`#6366f1`, `#818cf8` e,
 * pior, `#475569` no texto dos eixos — cinza-ardósia sobre fundo `#F7F1E6`).
 * A exceção de data-viz do guia cobre o preenchimento da série, não o texto de
 * eixo, então tudo passou a token.
 */
export function ScoreEvolutionChart({ results }: { results: SimuladoResult[] }) {
  const data = [...results].reverse().slice(-20);
  if (data.length < 2) return null;

  const W = 320;
  const H = 80;
  const PAD_X = 8;
  const PAD_Y = 8;

  const scores = data.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const x = (i: number) => PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2);
  const y = (score: number) => PAD_Y + (1 - (score - min) / range) * (H - PAD_Y * 2);

  const points = data.map((r, i) => `${x(i)},${y(r.score)}`).join(' ');
  const areaPoints = [
    `${x(0)},${H}`,
    ...data.map((r, i) => `${x(i)},${y(r.score)}`),
    `${x(data.length - 1)},${H}`,
  ].join(' ');

  return (
    <div>
      <p className="mb-1 text-xs font-medium" style={{ color: 'var(--hub-subtle)' }}>Evolução do acerto</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: 80 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hub-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--hub-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#scoreGrad)" />
        <polyline
          points={points}
          fill="none"
          stroke="var(--hub-accent)"
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].score)} r="3" fill="var(--hub-accent)" />
        <text x={W - 2} y={PAD_Y + 4} fontSize="8" fill="var(--hub-subtle)" textAnchor="end">
          {Math.round(max)}%
        </text>
        <text x={W - 2} y={H - 2} fontSize="8" fill="var(--hub-subtle)" textAnchor="end">
          {Math.round(min)}%
        </text>
      </svg>
    </div>
  );
}
