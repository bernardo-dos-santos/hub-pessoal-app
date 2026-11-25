import { useMemo, useState } from 'react';
import { ModuleAttentionCard } from '../../../core/alerts/ModuleAttentionCard';
import { Card, ListRow, ModuleHeader, Select, tint, hub } from '../../../shared/ui';
import { collegeAlertProvider } from '../alerts/collegeAlertProvider';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { CollegeUrgencyBoard } from '../components/CollegeUrgencyBoard';
import { SigaaNoticesCard } from '../components/SigaaNoticesCard';
import { collegeSummaryService } from '../services/collegeSummaryService';
import { type CollegeUrgencyItem, type CollegeUrgencyItemKindFilter } from '../types/college';
import { countCollegeUrgencyItems, filterCollegeUrgencyGroups } from '../utils/collegeUrgency';
import { localDayKey as dayKey } from '../../../shared/dates/localDay';

const urgencyTypeFilters: Array<{ label: string; value: CollegeUrgencyItemKindFilter }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Tarefas', value: 'task' },
  { label: 'Avaliações', value: 'assessment' },
];

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' } as const;
const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Today and the six days after it — the window the hero answers for. */
function nextSevenDays(): Date[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12));
}

function relativeDay(key: string, todayKey: string, tomorrowKey: string) {
  if (key === todayKey) return 'hoje';
  if (key === tomorrowKey) return 'amanhã';
  const date = new Date(`${key}T12:00:00`);
  return `${WEEKDAY[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`;
}

function heroSentence(overdue: number, week: CollegeUrgencyItem[], subjectName: (id: string) => string, todayKey: string, tomorrowKey: string) {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} atrasada${overdue === 1 ? '' : 's'} — comece por ela${overdue === 1 ? '' : 's'}.`);
  const next = week[0];
  if (next) {
    const subject = subjectName(next.subjectId);
    parts.push(`A próxima é ${next.title}${subject ? ` (${subject})` : ''}, ${relativeDay(next.date.slice(0, 10), todayKey, tomorrowKey)}.`);
  } else if (overdue === 0) {
    parts.push('Nada para entregar nos próximos 7 dias.');
  }
  return parts.join(' ');
}

/**
 * Resumo da Faculdade — the answer first: what is due in the next seven days,
 * a strip to look at each day, and "Precisa de você" beside it. The full
 * urgency board stays below as the detail.
 */
export function CollegeDashboardPage() {
  const [urgencyTypeFilter, setUrgencyTypeFilter] = useState<CollegeUrgencyItemKindFilter>('all');
  const [urgencySubjectFilter, setUrgencySubjectFilter] = useState('all');
  const dashboardData = collegeSummaryService.getDashboardData();
  const days = useMemo(nextSevenDays, []);
  const todayKey = dayKey(days[0]);
  const tomorrowKey = dayKey(days[1]);
  const [selectedDay, setSelectedDay] = useState(todayKey);

  const subjectName = (id: string) => {
    const subject = dashboardData.subjects.find((s) => s.id === id);
    return subject ? (subject.shortName ?? subject.name) : '';
  };

  const groups = dashboardData.urgencyGroups;
  const overdue = groups.overdue.length;
  const lastKey = dayKey(days[6]);
  const week = [...groups.today, ...groups.thisWeek, ...groups.upcoming]
    .filter((item) => item.date && item.date.slice(0, 10) >= todayKey && item.date.slice(0, 10) <= lastKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  const countByDay = new Map<string, number>();
  for (const item of week) countByDay.set(item.date.slice(0, 10), (countByDay.get(item.date.slice(0, 10)) ?? 0) + 1);
  const dayItems = week.filter((item) => item.date.slice(0, 10) === selectedDay);

  const filteredUrgencyGroups = useMemo(
    () => filterCollegeUrgencyGroups(groups, { subjectId: urgencySubjectFilter, type: urgencyTypeFilter }),
    [groups, urgencySubjectFilter, urgencyTypeFilter],
  );
  const filteredUrgencyCount = countCollegeUrgencyItems(filteredUrgencyGroups);
  const { summary } = dashboardData;

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Resumo" tabs={COLLEGE_TABS} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card hero>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '10px' }}>Próximos 7 dias</p>
            <p className="leading-none tabular-nums" style={{ fontSize: 'clamp(34px, 10vw, 52px)', fontWeight: 400, letterSpacing: '-0.03em', color: 'var(--hub-text)' }}>
              {week.length} <span style={{ fontSize: '0.4em', letterSpacing: 0, color: 'var(--hub-muted)' }}>entrega{week.length === 1 ? '' : 's'}</span>
            </p>
            <p style={{ fontSize: '14px', marginTop: '12px', lineHeight: 1.5, color: overdue > 0 ? 'var(--hub-negative)' : 'var(--hub-text-body)' }}>
              {heroSentence(overdue, week, subjectName, todayKey, tomorrowKey)}
            </p>

            <div className="grid grid-cols-7 gap-1" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
              {days.map((date) => {
                const key = dayKey(date);
                const count = countByDay.get(key) ?? 0;
                const active = key === selectedDay;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${relativeDay(key, todayKey, tomorrowKey)}: ${count} entrega${count === 1 ? '' : 's'}`}
                    onClick={() => setSelectedDay(key)}
                    className="flex flex-col items-center py-2 transition-opacity hover:opacity-80"
                    style={{
                      background: active ? tint(hub.accent, 12) : 'none',
                      border: 'none',
                      borderRadius: 'var(--hub-radius-control)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: active ? 'var(--hub-accent)' : 'var(--hub-subtle)' }}>
                      {key === todayKey ? 'hoje' : WEEKDAY[date.getDay()]}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '16px', color: active ? 'var(--hub-accent)' : 'var(--hub-text)' }}>{date.getDate()}</span>
                    <span className="mt-1 flex h-1.5 gap-0.5">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--hub-accent)' }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: '12px' }}>
              {dayItems.length === 0 ? (
                <p className="py-2 text-sm" style={{ color: 'var(--hub-subtle)' }}>
                  Nada marcado para {relativeDay(selectedDay, todayKey, tomorrowKey)}.
                </p>
              ) : dayItems.map((item, index) => (
                <ListRow
                  key={item.id}
                  to={item.kind === 'task' ? '/faculdade/tarefas' : '/faculdade/avaliacoes'}
                  last={index === dayItems.length - 1}
                  label={(
                    <>
                      <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{item.title}</p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                        {[subjectName(item.subjectId), item.kind === 'task' ? 'tarefa' : 'avaliação'].filter(Boolean).join(' · ')}
                      </p>
                    </>
                  )}
                  value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
                />
              ))}
            </div>
          </Card>

          <ModuleAttentionCard provider={collegeAlertProvider} className="lg:hidden" />

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium uppercase" style={sectionLabel}>Tudo o que está aberto</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1">
                  {urgencyTypeFilters.map((filter) => (
                    <button
                      key={filter.value}
                      className={`hub-tab ${urgencyTypeFilter === filter.value ? 'active' : ''}`}
                      type="button"
                      onClick={() => setUrgencyTypeFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <Select className="text-xs" value={urgencySubjectFilter} onChange={setUrgencySubjectFilter}>
                  <Select.Option value="all">Todas as disciplinas</Select.Option>
                  {dashboardData.subjects.map((subject) => (
                    <Select.Option key={subject.id} value={subject.id}>{subject.shortName ?? subject.name}</Select.Option>
                  ))}
                </Select>
                {filteredUrgencyCount > 0 && (
                  <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                    {filteredUrgencyCount} item{filteredUrgencyCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
            <CollegeUrgencyBoard groups={filteredUrgencyGroups} subjects={dashboardData.subjects} />
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModuleAttentionCard provider={collegeAlertProvider} className="hidden lg:block" />
          <SigaaNoticesCard />
          <Card>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>Semestre {summary.currentSemester}</p>
            <ListRow to="/faculdade/disciplinas" label="Disciplinas ativas" value={<span className="tabular-nums">{summary.activeSubjects}</span>} />
            <ListRow to="/faculdade/tarefas" label="Tarefas pendentes" value={<span className="tabular-nums">{summary.pendingTasks}</span>} />
            <ListRow to="/faculdade/tarefas" label="Tarefas concluídas" value={<span className="tabular-nums">{summary.completedTasks}</span>} />
            <ListRow to="/faculdade/tarefas/captura" last label="Captura rápida" value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>} />
          </Card>
        </div>
      </div>
    </div>
  );
}
