import { type CompletionStatus } from '../../study/services/sessionCompletionService';
import { SESSION_TYPE_LABEL, type WeeklySession } from '../types/routine';

/**
 * One session of today's plan, markable as done / partial / skipped. Shared by
 * the Planejador's Hoje (the whole day) and Estudos' Hoje (study sessions only),
 * so both mark the same thing the same way.
 */
export function TodaySessionRow({
  session,
  status,
  last,
  onMark,
}: {
  session: WeeklySession;
  status: CompletionStatus | null;
  last: boolean;
  onMark: (status: CompletionStatus) => void;
}) {
  const statusColor = status === 'done' ? 'var(--hub-positive)' : status === 'partial' ? 'var(--hub-warning)' : 'var(--hub-subtle)';

  return (
    <div
      className="flex items-start justify-between gap-2"
      style={{ paddingTop: '10px', paddingBottom: '10px', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 tabular-nums" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
            {session.startTime}
          </span>
          <span
            className="truncate text-sm"
            style={{
              // Pulado vai para o token mais apagado em vez de opacidade (guia: nunca
              // opacidade em texto) — o riscado já diz que não aconteceu.
              color: status === 'skipped' ? 'var(--hub-subtle)' : status === 'done' ? 'var(--hub-positive)' : 'var(--hub-text)',
              textDecoration: status === 'skipped' ? 'line-through' : 'none',
            }}
          >
            {session.topic}
          </span>
        </div>
        <p className="mt-0.5" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
          {SESSION_TYPE_LABEL[session.type] ?? session.type} · <span className="tabular-nums">{session.durationMinutes}min</span>
          {status && (
            <span style={{ color: statusColor, fontWeight: 500 }}>
              {' · '}{status === 'done' ? '✓ feito' : status === 'partial' ? '~ parcial' : '✗ pulado'}
            </span>
          )}
        </p>
      </div>

      {status ? (
        <button
          type="button"
          onClick={() => onMark(status === 'done' ? 'skipped' : 'done')}
          className="shrink-0 text-[11px] transition-opacity hover:opacity-70"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-subtle)' }}
        >
          desfazer
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" aria-label={`Marcar ${session.topic} como feito`} onClick={() => onMark('done')} className="text-sm transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-positive)' }}>✓</button>
          <button type="button" aria-label={`Marcar ${session.topic} como parcial`} onClick={() => onMark('partial')} className="text-sm transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-warning)' }}>~</button>
          <button type="button" aria-label={`Marcar ${session.topic} como pulado`} onClick={() => onMark('skipped')} className="text-sm transition-opacity hover:opacity-70" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-negative)' }}>✗</button>
        </div>
      )}
    </div>
  );
}
