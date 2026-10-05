import { type ReactNode } from 'react';
import { type Signal, signalColor } from './tokens';

type ChipProps = {
  children: ReactNode;
  signal?: Signal;
  /** Cor explícita (sobrepõe o signal). */
  color?: string;
  className?: string;
};

/** Pill pequena para categoria/tipo/status: fundo colorido a 12%, texto na cor. */
export function Chip({ children, signal = 'accent', color, className = '' }: ChipProps) {
  const c = color ?? signalColor(signal);
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: 'var(--hub-radius-pill)',
        fontSize: '11px',
        fontWeight: 500,
        lineHeight: 1.5,
        color: c,
        background: `color-mix(in srgb, ${c} 12%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}
