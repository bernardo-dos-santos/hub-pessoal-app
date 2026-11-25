import { useState } from 'react';
import { Card } from '../../../shared/ui';
import { alertService } from '../services/alertService';
import { type CollegeAlert } from '../types/alert';

/** Notices the SIGAA sync brought in (class news, professor messages), dismissable one by one. */
export function SigaaNoticesCard() {
  const [alerts, setAlerts] = useState<CollegeAlert[]>(() => alertService.listActiveAlerts());
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  function dismissAlert(id: string) {
    alertService.dismiss(id);
    setAlerts(alertService.listActiveAlerts());
  }

  function dismissAll() {
    alertService.dismissAll();
    setAlerts([]);
  }

  function toggleAlert(id: string) {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-warning)' }}>
          Avisos do SIGAA ({alerts.length})
        </h3>
        <button
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
          type="button"
          onClick={dismissAll}
        >
          Dispensar todos
        </button>
      </div>
      <div>
        {alerts.map((alert, i) => {
          const isExpanded = expandedAlerts.has(alert.id);
          const hasContent = Boolean(alert.content);
          return (
            <div
              key={alert.id}
              className="py-3"
              style={{ borderBottom: i === alerts.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  className={`min-w-0 flex-1 text-left ${hasContent ? 'cursor-pointer' : 'cursor-default'}`}
                  type="button"
                  disabled={!hasContent}
                  onClick={() => hasContent && toggleAlert(alert.id)}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{alert.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                    {alert.subjectName && <span className="font-medium">{alert.subjectName} · </span>}
                    {alert.date ? new Date(alert.date).toLocaleDateString('pt-BR') : 'Sem data'}
                  </p>
                  {hasContent && (
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-muted)' }}>
                      {isExpanded
                        ? alert.content
                        : (alert.content!.length > 140
                            ? `${alert.content!.substring(0, 140)}…`
                            : alert.content)}
                    </p>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {hasContent && (
                    <button
                      className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      type="button"
                      title={isExpanded ? 'Recolher' : 'Expandir'}
                      onClick={() => toggleAlert(alert.id)}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                  <button
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                    type="button"
                    title="Dispensar"
                    onClick={() => dismissAlert(alert.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
