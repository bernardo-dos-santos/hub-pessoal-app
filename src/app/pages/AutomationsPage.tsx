import { useEffect, useState } from 'react';
import { BackButton, Card, Eyebrow, Select, StatusDot, signalColor, type Signal } from '../../shared/ui';
import { apiUrl } from '../../core/config/backendConfig';
import { refreshSystemHealth, type JobStatus, type SystemHealth } from '../../core/health/systemHealth';

type LogEntry = {
  timestamp: string;
  script: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
};

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info: 'var(--hub-accent)',
  warn: 'var(--hub-warning)',
  error: 'var(--hub-negative)',
  success: 'var(--hub-positive)',
};

const LEVEL_ICON: Record<LogEntry['level'], string> = {
  info: 'ℹ', warn: '⚠', error: '✕', success: '✓',
};

const STATUS: Record<JobStatus, { signal: Signal; label: string }> = {
  ok:      { signal: 'positive', label: 'ok' },
  error:   { signal: 'negative', label: 'falhou' },
  stale:   { signal: 'negative', label: 'parado' },
  unknown: { signal: 'neutral',  label: 'sem registro' },
};

type PublicAccess = NonNullable<SystemHealth['publicAccess']>;

const TUNNEL: Record<PublicAccess['tunnel']['status'], { signal: Signal; label: string }> = {
  ok:      { signal: 'positive', label: 'Acesso pela internet no ar' },
  running: { signal: 'positive', label: 'Túnel da Cloudflare rodando (sem confirmação da conexão)' },
  down:    { signal: 'negative', label: 'Acesso pela internet fora do ar — o túnel da Cloudflare caiu' },
  unknown: { signal: 'neutral',  label: 'Túnel da Cloudflare: estado desconhecido' },
};

/** The public address (F4): the tunnel, and certificates about to lock someone out. */
function PublicAccessRows({ access }: { access: PublicAccess }) {
  const tunnel = TUNNEL[access.tunnel.status];
  return (
    <>
      <div className="flex items-center gap-2.5 py-3" style={{ borderBottom: access.certificates.length > 0 ? '1px solid var(--hub-border)' : 'none' }}>
        <StatusDot signal={tunnel.signal} size={7} />
        <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
          {tunnel.label}
          {access.tunnel.connections !== null && (
            <span className="tabular-nums" style={{ color: 'var(--hub-subtle)' }}> · {access.tunnel.connections} conexões</span>
          )}
        </p>
      </div>
      {access.certificates.map((cert, i) => (
        <div
          key={`${cert.label}-${cert.notAfter}`}
          className="flex items-center gap-2.5 py-3"
          style={{ borderBottom: i === access.certificates.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
        >
          <StatusDot signal={cert.status === 'expired' ? 'negative' : 'warning'} size={7} />
          <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
            Certificado {cert.label} ({cert.userName}){' '}
            <span className="tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
              {cert.status === 'expired'
                ? `venceu em ${new Date(cert.notAfter).toLocaleDateString('pt-BR')}`
                : `vence em ${cert.daysLeft} dias`}
            </span>
          </p>
        </div>
      ))}
    </>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function cadence(everyHours: number | null): string {
  if (everyHours === null) return 'sob demanda';
  if (everyHours <= 24) return 'diário';
  if (everyHours <= 24 * 7) return 'semanal';
  return 'mensal';
}

export function AutomationsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    void refreshSystemHealth().then(setHealth);
    fetch(apiUrl('/api/logs'))
      .then((r) => {
        if (!r.ok) throw new Error();
        setBackendOnline(true);
        return r.json() as Promise<LogEntry[]>;
      })
      .then(setLogs)
      .catch(() => setBackendOnline(false))
      .finally(() => setLoading(false));
  }, []);

  const labelOf = (script: string) => health?.jobs.find((j) => j.script === script)?.label ?? script;
  const filtered = filter === 'all' ? logs : logs.filter((l) => l.script === filter);
  const scripts = [...new Set(logs.map((l) => l.script))];
  const onlineDevices = health?.agent.devices.filter((d) => d.online) ?? [];

  return (
    <div className="space-y-6 py-4">
      <BackButton />
      <h1 className="text-xl font-medium" style={{ color: 'var(--hub-text)' }}>Saúde do sistema</h1>

      {!backendOnline && !loading && (
        <p className="text-sm" style={{ color: 'var(--hub-warning)' }}>
          Servidor offline — não dá para saber o estado dos jobs daqui.
        </p>
      )}

      {health && (
        <Card>
          <Eyebrow style={{ marginBottom: '4px' }}>Serviços</Eyebrow>
          <div className="flex items-center gap-2.5 py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
            <StatusDot signal={health.ai.principalConfigured ? 'positive' : 'negative'} size={7} />
            <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
              {health.ai.principalConfigured ? 'IA com slot Principal configurado' : 'IA desligada — falta o slot Principal'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 py-3" style={{ borderBottom: health.publicAccess ? '1px solid var(--hub-border)' : 'none' }}>
            <StatusDot signal={onlineDevices.length > 0 ? 'positive' : 'neutral'} size={7} />
            <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
              {onlineDevices.length > 0
                ? `Agente local conectado: ${onlineDevices.map((d) => d.id).join(', ')}`
                : 'Agente local desconectado'}
            </p>
          </div>
          {health.publicAccess && <PublicAccessRows access={health.publicAccess} />}
        </Card>
      )}

      {health && (
        <Card>
          <Eyebrow style={{ marginBottom: '4px' }}>Jobs agendados</Eyebrow>
          {health.jobs.map((job, i) => (
            <div
              key={job.script}
              className="py-3"
              style={{ borderBottom: i === health.jobs.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StatusDot signal={STATUS[job.status].signal} size={7} />
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{job.label}</p>
                  <span className="text-[11px]" style={{ color: 'var(--hub-subtle)' }}>{cadence(job.everyHours)}</span>
                </div>
                <span className="shrink-0 text-xs font-medium" style={{ color: signalColor(STATUS[job.status].signal) }}>
                  {STATUS[job.status].label}
                </span>
              </div>
              {job.lastRun && (
                <p className="mt-0.5 truncate pl-[17px] text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                  {formatTime(job.lastRun)} — {job.lastMessage}
                </p>
              )}
            </div>
          ))}
        </Card>
      )}

      {backendOnline && (
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <Eyebrow>Log completo</Eyebrow>
            <Select value={filter} onChange={setFilter} className="w-auto text-xs">
              <Select.Option value="all">Todos</Select.Option>
              {scripts.map((s) => (
                <Select.Option key={s} value={s}>{labelOf(s)}</Select.Option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="py-3 text-center text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Nenhum registro ainda. Os scripts escrevem em <code>logs/sync-log.json</code>.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {filtered.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 py-2" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                  <span className="shrink-0 text-xs font-medium" style={{ color: LEVEL_COLOR[entry.level] }}>
                    {LEVEL_ICON[entry.level]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--hub-muted)' }}>{entry.message}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px]" style={{ color: 'var(--hub-subtle)' }}>{labelOf(entry.script)}</p>
                    <p className="text-[11px] tabular-nums" style={{ color: 'var(--hub-disabled)' }}>{formatTime(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
