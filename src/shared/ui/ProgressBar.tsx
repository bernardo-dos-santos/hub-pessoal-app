import { type Signal, signalColor } from './tokens';

type ProgressBarProps = {
  /** 0–1 (fração) ou 0–100 (percentual, se `percent`). */
  value: number;
  percent?: boolean;
  signal?: Signal;
  /** Altura do trilho em px (4–7). */
  height?: number;
  className?: string;
};

/**
 * Barra de progresso — trilho neutro + preenchimento colorido por semântica.
 * Default neutro (terracota-progress) quando não carrega sinal positivo/negativo.
 */
export function ProgressBar({
  value,
  percent = false,
  signal = 'neutral',
  height = 6,
  className = '',
}: ProgressBarProps) {
  const frac = percent ? value / 100 : value;
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return (
    <div
      className={className}
      style={{
        height: `${height}px`,
        borderRadius: '99px',
        background: 'rgba(58,44,34,0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: '99px',
          background: signalColor(signal),
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
