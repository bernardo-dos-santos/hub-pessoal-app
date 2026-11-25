import { Card, ModuleHeader } from '../../../shared/ui';
import { GoalRow } from '../components/GoalRow';
import { getGoalsTabs } from '../components/goalsTabs';
import { goalService } from '../services/goalService';

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '2px' } as const;

/** Metas que saíram do dia a dia: concluídas e abandonadas, mais recentes primeiro. */
export function GoalsClosedPage() {
  const byUpdate = (a: { updatedAt: string }, b: { updatedAt: string }) => b.updatedAt.localeCompare(a.updatedAt);
  const all = goalService.listGoals();
  const completed = all.filter((g) => g.status === 'completed').sort(byUpdate);
  const abandoned = all.filter((g) => g.status === 'abandoned').sort(byUpdate);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Metas" title="Encerradas" tabs={getGoalsTabs()} />
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card>
          <p className="font-medium uppercase" style={sectionLabel}>Concluídas</p>
          {completed.length === 0
            ? <p className="py-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhuma meta concluída ainda.</p>
            : completed.map((g, i) => <GoalRow key={g.id} goal={g} last={i === completed.length - 1} />)}
        </Card>
        {abandoned.length > 0 && (
          <Card>
            <p className="font-medium uppercase" style={sectionLabel}>Abandonadas</p>
            {abandoned.map((g, i) => <GoalRow key={g.id} goal={g} last={i === abandoned.length - 1} />)}
          </Card>
        )}
      </div>
    </div>
  );
}
