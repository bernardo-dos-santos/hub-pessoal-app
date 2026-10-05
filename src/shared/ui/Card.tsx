import { type CSSProperties, type ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  /** Card "hero" de destaque no topo — padding e sombra um pouco maiores. */
  hero?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
};

/**
 * Unidade estrutural básica do design system Terracota. Todo agrupamento de
 * conteúdo é um card claro flutuante — substitui os hairlines "sem container"
 * do DS dark. Cor/sombra/raio vêm sempre dos tokens.
 */
export function Card({ children, hero = false, className = '', style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--hub-card)',
        borderRadius: 'var(--hub-radius-card)',
        boxShadow: hero ? 'var(--hub-shadow-hero)' : 'var(--hub-shadow-card)',
        padding: hero ? '26px 28px' : '22px 24px',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
