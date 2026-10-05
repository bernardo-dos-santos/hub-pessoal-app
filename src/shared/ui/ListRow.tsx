import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type Signal } from './tokens';
import { StatusDot } from './StatusDot';

type ListRowProps = {
  /** Conteúdo à esquerda (título + meta). */
  label: ReactNode;
  /** Conteúdo à direita (valor). */
  value?: ReactNode;
  /** Dot de status opcional à esquerda. */
  dot?: Signal;
  /** Última linha não desenha o hairline inferior. */
  last?: boolean;
  to?: string;
  onClick?: () => void;
};

/**
 * Linha de lista dentro de um card: label à esquerda, valor à direita, hairline
 * embaixo. Mesmo princípio do DS dark, só que dentro de um card.
 */
export function ListRow({ label, value, dot, last = false, to, onClick }: ListRowProps) {
  const inner = (
    <div
      className="flex items-start justify-between gap-3"
      style={{
        padding: '11px 0',
        borderBottom: last ? 'none' : '1px solid var(--hub-border)',
      }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {dot && <span style={{ marginTop: '5px' }}><StatusDot signal={dot} size={7} /></span>}
        <div className="min-w-0">{label}</div>
      </div>
      {value != null && <div className="shrink-0 text-right tabular-nums">{value}</div>}
    </div>
  );

  if (to) {
    return <Link to={to} className="block transition-opacity hover:opacity-75">{inner}</Link>;
  }
  if (onClick) {
    return (
      <div onClick={onClick} className="cursor-pointer transition-opacity hover:opacity-75">{inner}</div>
    );
  }
  return inner;
}
