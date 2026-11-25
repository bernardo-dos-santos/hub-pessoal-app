import { useEffect, useRef } from 'react';

export type ToastAction = { label: string; onClick: () => void; primary?: boolean };

type ToastProps = {
  text: string;
  tone?: 'positive' | 'negative' | 'neutral';
  actions?: ToastAction[];
  /** Fades after this many ms; an action ("Desfazer") gets 10s by default, plain text 4s. */
  duration?: number;
  onClose: () => void;
};

/**
 * The result of an action, pinned to the bottom of the screen. A message at the
 * top of the page is invisible to someone who saved at the bottom of a long
 * form, or changed the 25th row of a list on a phone — they tapped again and
 * created duplicates. One per page: render it from the page's own state.
 */
export function Toast({ text, tone = 'neutral', actions = [], duration, onClose }: ToastProps) {
  const timeout = duration ?? (actions.length > 0 ? 10000 : 4000);
  // A fresh onClose every render must not restart the countdown.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), timeout);
    return () => window.clearTimeout(timer);
  }, [text, timeout]);

  const color = tone === 'negative' ? 'var(--hub-negative)' : tone === 'positive' ? 'var(--hub-positive)' : 'var(--hub-text)';

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-40 flex w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-x-4 gap-y-1"
      style={{
        background: 'var(--hub-card)',
        border: '1px solid var(--hub-border-strong)',
        borderRadius: 'var(--hub-radius-card)',
        boxShadow: 'var(--hub-shadow-menu)',
        padding: '10px 14px',
        fontSize: '13px',
      }}
    >
      <span className="min-w-0 flex-1" style={{ color }}>{text}</span>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="min-h-8 font-medium transition-opacity hover:opacity-70"
          style={{ color: action.primary ? 'var(--hub-accent)' : 'var(--hub-text-body)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
      <button
        type="button"
        aria-label="Fechar aviso"
        className="min-h-8 px-1 transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}
