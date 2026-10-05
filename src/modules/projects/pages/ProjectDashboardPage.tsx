import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Eyebrow, ModuleHeader } from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { parseConventionalCommit } from '../services/conventionalCommit';
import { gitLogService } from '../services/gitLogService';
import { projectMetricsService, type WeeklyPoint } from '../services/projectMetricsService';
import { projectMilestoneService, todayDate } from '../services/projectMilestoneService';
import { projectService } from '../services/projectService';
import { isCodeProject } from '../types/project';
import { isMilestoneOverdue } from '../types/projectMilestone';

/** dd/mm de uma data YYYY-MM-DD. */
function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

/**
 * Gráfico de barras verticais feito com div.
 *
 * Sem biblioteca de propósito: são barras proporcionais a um máximo, e trazer
 * um pacote de gráficos para isso custaria mais bundle do que o módulo inteiro.
 * Cor de preenchimento é a única exceção do guia onde Tailwind é permitido.
 */
function WeeklyBars({ points, emptyLabel }: { points: WeeklyPoint[]; emptyLabel: string }) {
  const max = Math.max(...points.map((p) => p.count), 1);
  const hasAny = points.some((p) => p.count > 0);

  if (!hasAny) {
    return <p className="text-xs" style={{ color: 'var(--hub-disabled)' }}>{emptyLabel}</p>;
  }

  return (
    <div className="flex items-end gap-1" style={{ height: '80px' }}>
      {points.map((point) => (
        <div key={point.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
          <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)', fontSize: '9px' }}>
            {point.count > 0 ? point.count : ''}
          </span>
          <div
            className="w-full rounded-sm bg-orange-400"
            style={{ height: `${(point.count / max) * 100}%`, minHeight: point.count > 0 ? '3px' : '1px', opacity: point.count > 0 ? 1 : 0.25 }}
            title={`Semana de ${shortDate(point.weekStart)}: ${point.count}`}
          />
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="shrink-0 text-xs" style={{ color: 'var(--hub-muted)', width: '110px' }}>{row.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-sm" style={{ background: 'var(--hub-surface-muted)' }}>
            <div className="h-full rounded-sm bg-orange-400" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-text-body)', width: '24px', textAlign: 'right' }}>
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

type GitStats = { byWeek: WeeklyPoint[]; byType: { label: string; count: number }[] } | null;

export function ProjectDashboardPage() {
  const { projectId = '' } = useParams();
  const project = projectService.getById(projectId);
  const [git, setGit] = useState<GitStats>(null);
  const [gitError, setGitError] = useState('');

  const repoName = project?.repoName;
  const isCode = project ? isCodeProject(project) : false;

  useEffect(() => {
    if (!isCode || !repoName) return;
    let cancelled = false;
    gitLogService.listCommits(repoName, { order: 'desc', limit: 300 })
      .then((commits) => {
        if (cancelled) return;
        const counts = new Map<string, number>();
        const types = new Map<string, number>();
        for (const commit of commits) {
          const week = new Date(commit.date);
          week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
          const key = week.toISOString().slice(0, 10);
          counts.set(key, (counts.get(key) ?? 0) + 1);
          const parsed = parseConventionalCommit(commit.subject);
          if (parsed) types.set(parsed.type, (types.get(parsed.type) ?? 0) + 1);
        }
        const byWeek: WeeklyPoint[] = [];
        const cursor = new Date();
        cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
        for (let i = 0; i < 12; i++) {
          const key = cursor.toISOString().slice(0, 10);
          byWeek.unshift({ weekStart: key, count: counts.get(key) ?? 0 });
          cursor.setUTCDate(cursor.getUTCDate() - 7);
        }
        const byType = [...types.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => ({ label, count }));
        setGit({ byWeek, byType });
      })
      .catch((e) => { if (!cancelled) setGitError(e instanceof Error ? e.message : 'Não foi possível ler os commits.'); });
    return () => { cancelled = true; };
  }, [isCode, repoName]);

  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Painel" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  const today = todayDate();
  const closedByWeek = projectMetricsService.closedByWeek(project.id, 12);
  const aging = projectMetricsService.openTaskAging(project.id);
  const medianDays = projectMetricsService.medianDaysToClose(project.id);
  const flow = projectMetricsService.issueFlow(project.id);
  const historyStart = projectMetricsService.historyStartsAt(project.id);
  const milestones = projectMilestoneService.listByProject(project.id);
  const oldest = projectMetricsService.oldestOpenTasks(project.id, 5);

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Painel"
        tabs={getProjectTabs(project)}
        back
      />

      <Card>
        <Eyebrow style={{ marginBottom: '10px' }}>Tarefas fechadas por semana</Eyebrow>
        <WeeklyBars points={closedByWeek} emptyLabel="Nenhuma tarefa fechada nas últimas 12 semanas." />
        {/* Sem esta linha, um gráfico zerado antes do log existir pareceria
            "nada aconteceu" em vez de "não estávamos gravando". */}
        <p className="mt-3 text-xs" style={{ color: 'var(--hub-disabled)' }}>
          {historyStart
            ? `Histórico registrado desde ${historyStart.slice(0, 10)} — o que é anterior a isso não foi gravado.`
            : 'Ainda não há histórico gravado para este projeto.'}
        </p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <Eyebrow>Tempo até fechar</Eyebrow>
            <p className="tabular-nums" style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
              {medianDays === null ? '—' : `${medianDays}d`}
            </p>
          </div>
          <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>
            {medianDays === null ? 'sem tarefa fechada no histórico' : 'mediana entre criar e concluir'}
          </p>
        </div>
      </Card>

      <Card>
        <Eyebrow style={{ marginBottom: '10px' }}>Idade das tarefas abertas</Eyebrow>
        <HorizontalBars rows={aging} />
        {oldest.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--hub-border)' }}>
            <Eyebrow style={{ marginBottom: '6px' }}>Mais antigas</Eyebrow>
            {oldest.map((task) => (
              <div key={task.id} className="flex items-baseline justify-between gap-3 py-1">
                <span className="min-w-0 flex-1 text-xs" style={{ color: 'var(--hub-text-body)' }}>{task.title}</span>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
                  {task.createdAt.slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Eyebrow style={{ marginBottom: '10px' }}>O que entra em Melhorias</Eyebrow>
        {flow.total === 0 ? (
          <p className="text-xs" style={{ color: 'var(--hub-disabled)' }}>Nenhuma melhoria anotada ainda.</p>
        ) : (
          <>
            <HorizontalBars
              rows={[
                { label: 'virou tarefa', count: flow.promoted },
                { label: 'descartada', count: flow.discarded },
                { label: 'ainda aberta', count: flow.open },
              ]}
            />
            <p className="mt-3 text-xs" style={{ color: 'var(--hub-muted)' }}>
              {flow.promoted === 0
                ? 'Nada do que foi anotado virou trabalho ainda — o inbox está sendo usado como depósito.'
                : `${Math.round((flow.promoted / flow.total) * 100)}% do que foi anotado virou trabalho.`}
            </p>
          </>
        )}
      </Card>

      {milestones.length > 0 && (
        <Card>
          <Eyebrow style={{ marginBottom: '10px' }}>Marcos</Eyebrow>
          {milestones.map((milestone, i) => (
            <div
              key={milestone.id}
              className="flex items-baseline justify-between gap-3 py-2"
              style={{ borderBottom: i === milestones.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <span
                className="min-w-0 flex-1 text-sm"
                style={{ color: milestone.reachedAt ? 'var(--hub-disabled)' : 'var(--hub-text-body)' }}
              >
                {milestone.reachedAt ? '✓ ' : '○ '}{milestone.title}
              </span>
              {milestone.targetDate && (
                <span
                  className="shrink-0 text-xs tabular-nums"
                  style={{ color: isMilestoneOverdue(milestone, today) ? 'var(--hub-negative)' : 'var(--hub-muted)' }}
                >
                  {milestone.targetDate}
                </span>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Só projeto de código: numa reforma de quarto estas duas faixas não
          existiriam, e mostrar "0 commits" seria ruído, não informação. */}
      {isCode && (
        <Card>
          <Eyebrow style={{ marginBottom: '10px' }}>Commits por semana</Eyebrow>
          {gitError ? (
            <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>{gitError}</p>
          ) : !git ? (
            <p className="text-xs" style={{ color: 'var(--hub-disabled)' }}>
              {repoName ? 'Lendo o repositório…' : 'Nenhum repositório vinculado.'}
            </p>
          ) : (
            <>
              <WeeklyBars points={git.byWeek} emptyLabel="Nenhum commit nas últimas 12 semanas." />
              {git.byType.length > 0 && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--hub-border)' }}>
                  <Eyebrow style={{ marginBottom: '6px' }}>Por tipo</Eyebrow>
                  <HorizontalBars rows={git.byType} />
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
