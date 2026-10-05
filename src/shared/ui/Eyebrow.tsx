import { type CSSProperties, type ReactNode } from 'react';

type EyebrowProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Rótulo de seção — único uso de uppercase no sistema.
 * 10.5px / weight 600 / uppercase / letter-spacing .12em / cor de label.
 */
export function Eyebrow({ children, className = '', style }: EyebrowProps) {
  return (
    <p
      className={className}
      style={{
        margin: 0,
        fontSize: '10.5px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--hub-label)',
        ...style,
      }}
    >
      {children}
    </p>
  );
}
