import { type CSSProperties } from 'react';

type HeroValueProps = {
  children: React.ReactNode;
  /** Tamanho da fonte em px (hero result ~52–58; heroes de seção ~24). */
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Número hero — weight 300, letter-spacing negativo, tabular. Usado em valores
 * de destaque (saldo do mês, métricas grandes).
 */
export function HeroValue({ children, size = 52, color = 'var(--hub-text)', className = '', style }: HeroValueProps) {
  return (
    <span
      className={`tabular-nums ${className}`}
      style={{
        display: 'inline-block',
        fontSize: `${size}px`,
        fontWeight: 300,
        letterSpacing: '-0.02em',
        lineHeight: 1.05,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
