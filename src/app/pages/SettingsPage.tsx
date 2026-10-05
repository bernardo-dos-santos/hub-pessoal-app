import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../../shared/components/PageContainer';
import { PageHeader } from '../../shared/components/PageHeader';
import { usePushNotifications } from '../../core/push/usePushNotifications';
import { getStoreMode, resyncFromBackend } from '../../core/storage/bootstrapStore';
import { isCapacitorApp, TAILSCALE_BACKEND } from '../../core/config/backendConfig';

const PUSH_LABEL: Record<string, string> = {
  unsupported: 'Não suportado neste dispositivo',
  denied: 'Bloqueado pelo navegador',
  subscribed: 'Ativadas — toque para desativar',
  unsubscribed: 'Desativadas — toque para ativar',
  error: 'Erro ao ativar — toque para tentar de novo',
};

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

const sectionTitleStyle = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
} as const;

const rowStyle = { borderBottom: '1px solid var(--hub-border)' } as const;

export function SettingsPage() {
  const push = usePushNotifications();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  const mode = getStoreMode();
  const isApi = mode === 'api';

  async function handleResync() {
    setSyncStatus('loading');
    setSyncMsg('');
    try {
      await resyncFromBackend();
      setSyncStatus('success');
      setSyncMsg('Dados recarregados! Recarregando app…');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setSyncStatus('error');
      setSyncMsg(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="Preferências" title="Configurações" />

      {/* ── Servidor & Sincronização ─────────────────────────────────── */}
      <section>
        <h2 className="mb-1" style={sectionTitleStyle}>Servidor</h2>

        {/* Status da conexão */}
        <div className="py-3.5" style={rowStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Fonte de dados</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                {isApi
                  ? 'Backend SQLite (dados em tempo real)'
                  : 'Armazenamento local (offline)'}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: isApi ? 'var(--hub-positive)' : 'var(--hub-subtle)' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: isApi ? 'var(--hub-positive)' : 'var(--hub-disabled)' }} />
              {isApi ? 'Online' : 'Offline'}
            </span>
          </div>

          {isCapacitorApp() && (
            <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Tailscale: {TAILSCALE_BACKEND}
            </p>
          )}
        </div>

        {/* Botão de resync */}
        <button
          onClick={handleResync}
          disabled={syncStatus === 'loading'}
          className="flex w-full items-center justify-between py-3.5 transition-opacity hover:opacity-80 disabled:opacity-60"
          style={{ background: 'none', border: 'none', cursor: 'pointer', ...rowStyle }}
        >
          <div className="text-left">
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Recarregar dados do servidor</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
              {syncStatus === 'loading'
                ? 'Conectando ao backend…'
                : 'Busca todos os dados atualizados do backend SQLite'}
            </p>
          </div>
          <span style={{ color: 'var(--hub-accent)' }}>↻</span>
        </button>

        {/* Feedback do sync */}
        {syncMsg && (
          <p className="py-2 text-xs" style={{ color: syncStatus === 'success' ? 'var(--hub-positive)' : 'var(--hub-negative)' }}>
            {syncMsg}
          </p>
        )}
      </section>

      {/* ── Notificações ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1" style={sectionTitleStyle}>Notificações</h2>
        <button
          onClick={push.state !== 'unsupported' && push.state !== 'denied' ? push.toggle : undefined}
          disabled={push.state === 'unsupported' || push.state === 'denied'}
          className="flex w-full items-center justify-between py-3.5 transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'none', border: 'none', cursor: 'pointer', ...rowStyle }}
        >
          <div>
            <p className="text-left text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Push Notifications</p>
            <p className="text-left text-xs" style={{ color: 'var(--hub-subtle)' }}>{PUSH_LABEL[push.state] ?? push.state}</p>
          </div>
          <span
            className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
            style={{ background: push.state === 'subscribed' ? 'var(--hub-positive)' : 'var(--hub-border-strong)' }}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${push.state === 'subscribed' ? 'left-4' : 'left-0.5'}`} />
          </span>
        </button>
        {push.errorMsg && (
          <p className="py-2 text-xs" style={{ color: 'var(--hub-negative)' }}>
            {push.errorMsg}
          </p>
        )}
      </section>

      {/* ── Inteligência Artificial ───────────────────────────────────── */}
      <section>
        <h2 className="mb-1" style={sectionTitleStyle}>Inteligência Artificial</h2>
        <Link
          to="/configuracoes/ia"
          className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
          style={rowStyle}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Conexão com IA</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Principal, Secundária e Fallback — provedor, chave e modelo</p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
      </section>

      {/* ── Dados ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1" style={sectionTitleStyle}>Dados</h2>
        <Link
          to="/backup"
          className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
          style={rowStyle}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Backup e Restauração</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Exportar ou importar todos os dados do Hub</p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
        <Link
          to="/automacoes"
          className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
          style={rowStyle}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Automações</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Status dos scripts e log de sincronizações</p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
      </section>
    </PageContainer>
  );
}
