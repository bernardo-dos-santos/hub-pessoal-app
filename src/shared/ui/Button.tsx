import { type ButtonHTMLAttributes, type CSSProperties } from 'react';

type Variant = 'primary' | 'text' | 'secondary' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const VARIANT_STYLE: Record<Variant, CSSProperties> = {
  // Ação primária — pill preenchida terracota.
  primary: {
    background: 'var(--hub-primary)',
    color: '#FFF8F0',
    borderRadius: 'var(--hub-radius-pill)',
    padding: '10px 24px',
    fontWeight: 600,
    fontSize: '14px',
    border: 'none',
  },
  // Ação de texto terracota (link/CTA leve).
  text: {
    background: 'none',
    color: 'var(--hub-primary)',
    border: 'none',
    fontWeight: 500,
    fontSize: '14px',
  },
  // Secundária / cancelar — texto apagado.
  secondary: {
    background: 'none',
    color: 'var(--hub-muted)',
    border: 'none',
    fontWeight: 400,
    fontSize: '13px',
  },
  // Destrutiva.
  danger: {
    background: 'none',
    color: 'var(--hub-negative)',
    border: 'none',
    fontWeight: 500,
    fontSize: '13px',
  },
};

export function Button({ variant = 'primary', className = '', style, ...rest }: ButtonProps) {
  return (
    <button
      className={`transition-opacity hover:opacity-80 disabled:opacity-40 ${className}`}
      style={{ cursor: 'pointer', ...VARIANT_STYLE[variant], ...style }}
      {...rest}
    />
  );
}
