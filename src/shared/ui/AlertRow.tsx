import { Link } from 'react-router-dom';
import { type Signal, signalColor } from './tokens';
import { StatusDot } from './StatusDot';

type AlertRowProps = {
  title: string;
  subtitle?: string;
  signal?: Signal;
  /** Texto da ação à direita (ex.: "Ver", "Revisar"). Recebe "→" automático. */
  action?: string;
  to?: string;
  onClick?: () => void;
  last?: boolean;
};

/**
 * Linha de atenção clicável: dot colorido + texto + "Ação →" à direita em cor
 * semântica. Mesmo padrão em Início, Financeiro, Faculdade.
 */
export function AlertRow({
  title,
  subtitle,
  signal = 'negative',
  action = 'Ver',
  to,
  onClick,
  last = false,
}: AlertRowProps) {
  const color = signalColor(signal);
  const inner = (
    <div
      className="flex items-center justify-between gap-3"
      style={{ padding: '11px 0', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span style={{ marginTop: '4px' }}><StatusDot color={color} size={7} /></span>
        <div className="min-w-0">
          <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{title}</p>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--hub-muted)' }}>{subtitle}</p>
          )}
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium" style={{ color }}>{action} →</span>
    </div>
  );

  if (to) return <Link to={to} className="block transition-opacity hover:opacity-75">{inner}</Link>;
  if (onClick) {
    return <div onClick={onClick} className="cursor-pointer transition-opacity hover:opacity-75">{inner}</div>;
  }
  return inner;
}
