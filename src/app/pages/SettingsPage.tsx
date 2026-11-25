import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../../shared/components/PageContainer';
import { PageHeader } from '../../shared/components/PageHeader';
import { usePushNotifications } from '../../core/push/usePushNotifications';
import { getStoreMode, resyncFromBackend } from '../../core/storage/bootstrapStore';
import { backendRoute, isCapacitorApp } from '../../core/config/backendConfig';
import { canSeeAdmin, useSession } from '../../core/session/session';
import { modules } from '../../core/module-registry/modules';
import { installedVersionName } from '../../core/appUpdate/appUpdate';
import { setThemePreference, useThemePreference, type ThemePreference } from '../../core/theme/theme';
import { ChoiceCard } from '../../shared/ui';

const THEME_OPTIONS: { value: ThemePreference; title: string; description: string }[] = [
  { value: 'system', title: 'Sistema', description: 'Acompanha o claro/escuro do aparelho' },
  { value: 'dark', title: 'Escuro', description: 'Fundo escuro, sempre' },
  { value: 'light', title: 'Claro', description: 'Fundo claro, sempre' },
];

const PUSH_LABEL: Record<string, string> = {
  unsupported: 'Não suportado neste dispositivo',
  denied: 'Bloqueado pelo navegador',
  subscribed: 'Ativadas — toque para desativar',
  unsubscribed: 'Desativadas — toque para ativar',
  error: 'Erro ao ativar — toque para tentar de novo',
};

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

const sectionTitleStyle = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  color: 'var(--hub-subtle)',
} as const;

const rowStyle = { borderBottom: '1px solid var(--hub-border)' } as const;

export function SettingsPage() {
  const session = useSession();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  useEffect(() => {
    void installedVersionName().then(setAppVersion);
  }, []);
  const push = usePushNotifications();
  const themePreference = useThemePreference();
  const enabledCount = session.modules?.length ?? modules.length;
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

      {/* ── Conta ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1" style={sectionTitleStyle}>Conta</h2>
        <Link
          to="/configuracoes/modulos"
          className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
          style={rowStyle}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Módulos</p>
            <p className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
              {enabledCount} de {modules.length} ligados — escolha o que aparece no seu Olimpo
            </p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
        <Link
          to="/configuracoes/conexoes"
          className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
          style={rowStyle}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Conexões</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Banco (Open Finance) e as outras integrações dos seus módulos</p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
        {canSeeAdmin(session) && (
          <Link
            to="/admin"
            className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
            style={rowStyle}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Usuários</p>
              <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Painel admin — criar, desativar e ver o Olimpo como outra pessoa</p>
            </div>
            <span style={{ color: 'var(--hub-subtle)' }}>→</span>
          </Link>
        )}
      </section>

      {/* ── Aparência ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3" style={sectionTitleStyle}>Aparência</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          {THEME_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              active={themePreference === option.value}
              title={option.title}
              description={option.description}
              onClick={() => setThemePreference(option.value)}
            />
          ))}
        </div>
      </section>

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
              {backendRoute() === 'tailscale'
                ? 'Conectado pelo Tailscale'
                : 'Conectado pelo endereço público (painel admin e aprovações das mãos só pelo Tailscale)'}
            </p>
          )}
          {appVersion && (
            <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
              Versão do app: {appVersion}
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
            style={{ background: push.state === 'subscribed' ? 'var(--hub-primary)' : 'var(--hub-border-strong)' }}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform ${push.state === 'subscribed' ? 'left-4' : 'left-0.5'}`}
              style={{ background: push.state === 'subscribed' ? 'var(--hub-on-accent)' : 'var(--hub-muted)' }}
            />
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
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Exportar ou importar todos os dados do Olimpo</p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
        {session.isOwner && (
        <Link
          to="/automacoes"
          className="flex items-center justify-between py-3.5 transition-opacity hover:opacity-80"
          style={rowStyle}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Saúde do sistema</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Jobs agendados, agente local, IA e log de sincronizações</p>
          </div>
          <span style={{ color: 'var(--hub-subtle)' }}>→</span>
        </Link>
        )}
      </section>
    </PageContainer>
  );
}
