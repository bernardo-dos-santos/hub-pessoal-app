import { Link } from 'react-router-dom';
import { ProgressBar } from '../../../shared/ui';
import { goalCategoryMeta } from '../data/goalCategories';
import { goalService } from '../services/goalService';
import { type Goal } from '../types/goal';

/** `YYYY-MM-DD` as a local date — `new Date(iso)` would show the day before. */
export function formatGoalDate(date: string): string {
  return new Date(date.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR');
}

function deadlineText(goal: Goal): { text: string; color: string } | null {
  const days = goalService.daysUntilTarget(goal);
  if (days === null || !goal.targetDate) return null;
  if (goal.status !== 'active') return { text: `Prazo: ${formatGoalDate(goal.targetDate)}`, color: 'var(--hub-subtle)' };
  if (days < 0) return { text: `Prazo passou há ${-days} ${days === -1 ? 'dia' : 'dias'}`, color: 'var(--hub-negative)' };
  if (days === 0) return { text: 'Vence hoje', color: 'var(--hub-warning)' };
  return { text: `Vence em ${days} ${days === 1 ? 'dia' : 'dias'} · ${formatGoalDate(goal.targetDate)}`, color: days <= 7 ? 'var(--hub-warning)' : 'var(--hub-subtle)' };
}

/** One goal in a list: title, category, key-result progress and deadline. */
export function GoalRow({ goal, last }: { goal: Goal; last: boolean }) {
  const progress = goalService.getProgress(goal);
  const { label, color } = goalCategoryMeta(goal.category);
  const doneKRs = goal.keyResults.filter((kr) => kr.status === 'done').length;
  const deadline = deadlineText(goal);

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
          <span className="text-[11px] font-medium" style={{ color }}>{label}</span>
        </div>
      </div>
      {goal.description && (
        <p className="mb-3 line-clamp-2 text-xs" style={{ color: 'var(--hub-muted)' }}>{goal.description}</p>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs tabular-nums">
          <span style={{ color: 'var(--hub-muted)' }}>{doneKRs}/{goal.keyResults.length} key results</span>
          <span style={{ color: progress === 100 ? 'var(--hub-positive)' : 'var(--hub-primary)' }}>{progress}%</span>
        </div>
        <ProgressBar value={progress} percent signal={progress === 100 ? 'positive' : 'accent'} />
      </div>
      {deadline && (
        <p className="mt-2 text-[11px] tabular-nums" style={{ color: deadline.color }}>{deadline.text}</p>
      )}
    </Link>
  );
}
