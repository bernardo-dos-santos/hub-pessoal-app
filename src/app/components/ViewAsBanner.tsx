import { useState } from 'react';
import { stopViewingAs, useSession } from '../../core/session/session';
import { hub, tint } from '../../shared/ui';

/**
 * Shown on every screen while the admin is viewing the Hub as someone else —
 * the data on screen is that person's, and writing to it changes their Hub.
 */
export function ViewAsBanner() {
  const session = useSession();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  if (!session.viewingAs) return null;

  async function leave() {
    setLeaving(true);
    setError('');
    try {
      await stopViewingAs();
    } catch {
      setLeaving(false);
      setError('Sem conexão com o servidor — tente de novo quando ele voltar.');
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-xs"
      style={{ background: tint(hub.accent, 14), color: 'var(--hub-text)' }}
    >
      <span>
        Vendo o Olimpo como <strong className="font-medium">{session.name}</strong> — o que você mudar aqui muda o Olimpo dessa pessoa.
      </span>
      <button
        onClick={leave}
        disabled={leaving}
        className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {leaving ? 'Voltando…' : `Voltar para ${session.realUser.name || 'você'}`}
      </button>
      {error && <span style={{ color: 'var(--hub-negative)' }}>{error}</span>}
    </div>
  );
}
