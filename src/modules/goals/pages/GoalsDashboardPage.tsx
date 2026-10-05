import { Link } from 'react-router-dom';
import { goalService } from '../services/goalService';
import { type Goal, type GoalCategory } from '../types/goal';
import { Card, ProgressBar, BackButton, Eyebrow } from '../../../shared/ui';

const CATEGORY_LABEL: Record<GoalCategory, string> = {
  concurso: 'Concurso', financeiro: 'Financeiro', saude: 'Saúde',
  pessoal: 'Pessoal', faculdade: 'Faculdade',
};

const CATEGORY_COLOR: Record<GoalCategory, string> = {
  concurso:   'var(--hub-negative)',
  financeiro: 'var(--hub-positive)',
  saude:      'var(--hub-accent)',
  pessoal:    'var(--hub-mauve)',
  faculdade:  'var(--hub-warning)',
};

function GoalCard({ goal, last }: { goal: Goal; last: boolean }) {
  const progress = goalService.getProgress(goal);
  const color = CATEGORY_COLOR[goal.category];
  const doneKRs = goal.keyResults.filter((kr) => kr.status === 'done').length;

  return (
    <Link
      to={`/metas/${goal.id}`}
      className="block transition-opacity hover:opacity-80"
      style={{ padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="font-medium leading-snug" style={{ color: 'var(--hub-text)' }}>{goal.title}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[10px] font-medium" style={{ color }}>{CATEGORY_LABEL[goal.category]}</span>
        </div>
      </div>
      {goal.description && (
        <p className="mb-3 line-clamp-2 text-xs" style={{ color: 'var(--hub-muted)' }}>
          {goal.description}
        </p>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs tabular-nums">
          <span style={{ color: 'var(--hub-muted)' }}>
            {doneKRs}/{goal.keyResults.length} key results
          </span>
          <span style={{ color: progress === 100 ? 'var(--hub-positive)' : 'var(--hub-primary)' }}>
            {progress}%
          </span>
        </div>
        <ProgressBar value={progress} percent signal={progress === 100 ? 'positive' : 'accent'} />
      </div>
      {goal.targetDate && (
        <p className="mt-2 text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
          Prazo: {new Date(goal.targetDate).toLocaleDateString('pt-BR')}
        </p>
      )}
    </Link>
  );
}

export function GoalsDashboardPage() {
  const all = goalService.listGoals();
  const active = all.filter((g) => g.status === 'active');
  const completed = all.filter((g) => g.status === 'completed');

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2"><BackButton /></div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <Eyebrow>Módulo · Objetivos</Eyebrow>
            <h1 className="mt-1 text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>Metas</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--hub-muted)' }}>
              {active.length} ativa{active.length !== 1 ? 's' : ''} · {completed.length} concluída{completed.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            to="/metas/nova"
            className="text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-primary)' }}
          >
            + Nova meta
          </Link>
        </div>
      </div>

      {active.length === 0 && completed.length === 0 ? (
        <Card className="text-center">
          <div className="py-8">
            <p className="text-3xl">🎯</p>
            <p className="mt-3 font-medium" style={{ color: 'var(--hub-text)' }}>Nenhuma meta ainda</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--hub-muted)' }}>
              Crie sua primeira meta para começar a acompanhar seu progresso.
            </p>
            <Link
              to="/metas/nova"
              className="mt-4 inline-block text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-primary)' }}
            >
              Criar meta →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <Eyebrow style={{ marginBottom: '8px' }}>Ativas</Eyebrow>
              <Card>
                {active.map((g, i) => <GoalCard key={g.id} goal={g} last={i === active.length - 1} />)}
              </Card>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <Eyebrow style={{ marginBottom: '8px' }}>Concluídas</Eyebrow>
              <Card>
                {completed.map((g, i) => <GoalCard key={g.id} goal={g} last={i === completed.length - 1} />)}
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
