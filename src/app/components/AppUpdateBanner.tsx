import { useEffect, useRef, useState } from 'react';
import { canInstallNow, findUpdate, installUpdate, type AppRelease } from '../../core/appUpdate/appUpdate';
import { hub, tint } from '../../shared/ui';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const linkButton = { color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' } as const;

type Status = 'idle' | 'downloading' | 'installing' | 'permission' | 'error';

/**
 * APK only. Checks the server at start and every few hours (the app stays open
 * for days on the phone). When Android already lets the Hub install updates,
 * it updates by itself — no tap; otherwise (the first time) a thin bar with
 * "Atualizar" walks the user through Android's permission.
 */
export function AppUpdateBanner() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  // One automatic attempt per version — a failing install must not loop.
  const autoTried = useRef<number | null>(null);

  async function update(found: AppRelease) {
    setError('');
    setStatus('downloading');
    setPercent(0);
    try {
      const outcome = await installUpdate(found, setPercent);
      setStatus(outcome === 'needs-permission' ? 'permission' : 'installing');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Não foi possível baixar a atualização.');
    }
  }

  useEffect(() => {
    const check = async () => {
      const found = await findUpdate().catch(() => null);
      setRelease(found);
      if (found && autoTried.current !== found.versionCode && (await canInstallNow())) {
        autoTried.current = found.versionCode;
        void update(found);
      }
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  if (!release) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-xs"
      style={{ background: tint(hub.positive, 16), color: 'var(--hub-text)' }}
    >
      <span>
        {status === 'installing' ? 'Instalando a versão ' : 'Nova versão do app: '}
        <strong className="font-medium">{release.versionName}</strong>
        {release.notes && status !== 'installing' ? ` — ${release.notes}` : ''}
      </span>
      {status === 'downloading' && <span className="tabular-nums" style={{ color: 'var(--hub-subtle)' }}>Baixando… {percent}%</span>}
      {status === 'installing' && <span style={{ color: 'var(--hub-subtle)' }}>o app vai fechar sozinho e avisar quando terminar.</span>}
      {(status === 'idle' || status === 'permission' || status === 'error') && (
        <button onClick={() => void update(release)} className="text-xs font-medium transition-opacity hover:opacity-70" style={linkButton}>
          Atualizar
        </button>
      )}
      {status === 'permission' && (
        <span style={{ color: 'var(--hub-text-body)' }}>
          Permita "instalar apps desconhecidos" para o Olimpo na tela que abriu, volte e toque em Atualizar — é só desta vez.
        </span>
      )}
      {status === 'error' && <span style={{ color: 'var(--hub-negative)' }}>{error}</span>}
    </div>
  );
}
