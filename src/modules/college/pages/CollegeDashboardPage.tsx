import { useMemo, useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { CollegeUrgencyBoard } from '../components/CollegeUrgencyBoard';
import { alertService } from '../services/alertService';
import { collegeSummaryService } from '../services/collegeSummaryService';
import { type CollegeAlert } from '../types/alert';
import { type CollegeUrgencyItemKindFilter } from '../types/college';
import { countCollegeUrgencyItems, filterCollegeUrgencyGroups } from '../utils/collegeUrgency';

const urgencyTypeFilters: Array<{ label: string; value: CollegeUrgencyItemKindFilter }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Tarefas', value: 'task' },
  { label: 'Avaliações', value: 'assessment' },
];

export function CollegeDashboardPage() {
  const [urgencyTypeFilter, setUrgencyTypeFilter] = useState<CollegeUrgencyItemKindFilter>('all');
  const [urgencySubjectFilter, setUrgencySubjectFilter] = useState('all');
  const [alerts, setAlerts] = useState<CollegeAlert[]>(() => alertService.listActiveAlerts());
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const dashboardData = collegeSummaryService.getDashboardData();

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

  const filteredUrgencyGroups = useMemo(
    () => filterCollegeUrgencyGroups(dashboardData.urgencyGroups, {
      subjectId: urgencySubjectFilter,
      type: urgencyTypeFilter,
    }),
    [dashboardData.urgencyGroups, urgencySubjectFilter, urgencyTypeFilter],
  );
  const filteredUrgencyCount = countCollegeUrgencyItems(filteredUrgencyGroups);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Painel" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Semestre {dashboardData.summary.currentSemester}.
      </p>

      {alerts.length > 0 && (
        <Card className="mb-5" style={{ borderLeft: '2px solid var(--hub-warning)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-warning)' }}>
              🔔 Avisos do SIGAA ({alerts.length})
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
      )}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>O que preciso fazer agora?</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1">
              {urgencyTypeFilters.map((filter) => {
                const isActive = urgencyTypeFilter === filter.value;
                return (
                  <button
                    key={filter.value}
                    className="px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{
                      color: isActive ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                      background: 'none',
                      border: 'none',
                      borderBottom: `1px solid ${isActive ? 'var(--hub-accent)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                    type="button"
                    onClick={() => setUrgencyTypeFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <Select
              className="bg-transparent text-xs outline-none cursor-pointer appearance-none"
              value={urgencySubjectFilter}
              onChange={setUrgencySubjectFilter}
            >
              <Select.Option value="all">Todas as disciplinas</Select.Option>
              {dashboardData.subjects.map((subject) => (
                <Select.Option key={subject.id} value={subject.id}>{subject.shortName ?? subject.name}</Select.Option>
              ))}
            </Select>
            {filteredUrgencyCount > 0 && (
              <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                {filteredUrgencyCount} item{filteredUrgencyCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        </div>
        <CollegeUrgencyBoard groups={filteredUrgencyGroups} subjects={dashboardData.subjects} />
      </Card>
    </div>
  );
}
