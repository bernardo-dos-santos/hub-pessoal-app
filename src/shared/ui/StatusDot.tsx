import { type Signal, signalColor } from './tokens';

type StatusDotProps = {
  signal?: Signal;
  /** Diâmetro em px (7–8). */
  size?: number;
  /** Cor explícita (sobrepõe o signal). */
  color?: string;
  className?: string;
};

/** Círculo pequeno cuja cor é o sinal semântico da linha. */
export function StatusDot({ signal = 'neutral', size = 8, color, className = '' }: StatusDotProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: color ?? signalColor(signal),
        flexShrink: 0,
      }}
    />
  );
}
