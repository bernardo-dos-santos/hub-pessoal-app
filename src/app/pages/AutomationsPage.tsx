import { useEffect, useState } from 'react';
import { BackButton, Select } from '../../shared/ui';

type LogEntry = {
  timestamp: string;
  script: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
};

const SCRIPT_LABELS: Record<string, string> = {
  'sigaa-sync': 'SIGAA Sync',
  'pluggy-sync': 'Open Finance',
  'nubank-invoice-gmail-sync': 'Nubank Fatura',
  'edital-monitor': 'Edital Monitor',
  'gdrive-backup': 'Backup Drive',
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

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

type ScriptSummary = {
  script: string;
  lastRun: string | null;
  lastLevel: LogEntry['level'] | null;
  lastMessage: string | null;
};

function buildSummaries(logs: LogEntry[]): ScriptSummary[] {
  const known = Object.keys(SCRIPT_LABELS);
  const seen = new Map<string, ScriptSummary>();
  for (const entry of logs) {
    if (!seen.has(entry.script)) {
      seen.set(entry.script, {
        script: entry.script,
        lastRun: entry.timestamp,
        lastLevel: entry.level,
        lastMessage: entry.message,
      });
    }
  }
  // Inclui scripts conhecidos mesmo sem logs
  for (const s of known) {
    if (!seen.has(s)) seen.set(s, { script: s, lastRun: null, lastLevel: null, lastMessage: null });
  }
  return [...seen.values()].sort((a, b) => (a.lastRun ?? '').localeCompare(b.lastRun ?? '') * -1);
}

export function AutomationsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    fetch('/api/logs')
      .then((r) => {
        if (!r.ok) throw new Error();
        setBackendOnline(true);
        return r.json() as Promise<LogEntry[]>;
      })
      .then(setLogs)
      .catch(() => setBackendOnline(false))
      .finally(() => setLoading(false));
  }, []);

  const summaries = buildSummaries(logs);
  const filtered = filter === 'all' ? logs : logs.filter((l) => l.script === filter);
  const scripts = [...new Set(logs.map((l) => l.script))];

  return (
    <div className="space-y-8 py-4">
      <BackButton />
      <h1 className="text-xl font-medium" style={{ color: 'var(--hub-text)' }}>Automações</h1>

      {!backendOnline && !loading && (
        <p className="text-sm" style={{ color: 'var(--hub-warning)' }}>
          Servidor offline — inicie o backend para ver os logs de sincronização.
        </p>
      )}

      {/* Resumo por script */}
      {backendOnline && (
        <section>
          <h2 className="mb-2 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Status dos scripts</h2>
          <div>
            {summaries.map((s) => (
              <div key={s.script} className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>
                    {SCRIPT_LABELS[s.script] ?? s.script}
                  </p>
                  {s.lastLevel ? (
                    <span className="text-xs font-medium" style={{ color: LEVEL_COLOR[s.lastLevel] }}>
                      {LEVEL_ICON[s.lastLevel]} {s.lastLevel}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Sem registros</span>
                  )}
                </div>
                {s.lastRun && (
                  <p className="mt-0.5 truncate text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                    Último: {formatTime(s.lastRun)} — {s.lastMessage}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Log completo */}
      {backendOnline && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Log completo</h2>
            <Select
              value={filter}
              onChange={setFilter}
              className="w-auto text-xs"
            >
              <Select.Option value="all">Todos</Select.Option>
              {scripts.map((s) => (
                <Select.Option key={s} value={s}>{SCRIPT_LABELS[s] ?? s}</Select.Option>
              ))}
            </Select>
          </div>

          {loading ? (
            <p className="animate-pulse py-3 text-center text-xs" style={{ color: 'var(--hub-subtle)' }}>Carregando…</p>
          ) : filtered.length === 0 ? (
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
                    <p className="text-[10px]" style={{ color: 'var(--hub-subtle)' }}>{SCRIPT_LABELS[entry.script] ?? entry.script}</p>
                    <p className="text-[10px] tabular-nums" style={{ color: 'var(--hub-disabled)' }}>{formatTime(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
