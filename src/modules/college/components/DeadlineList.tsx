import { type Assessment } from '../types/assessment';
import { type Subject } from '../types/subject';
import { type CollegeTask } from '../types/task';
import { formatAssessmentType, formatCollegeDate, formatTaskPriority, formatTaskStatus } from '../utils/collegeFormatters';

type DeadlineListProps = {
  assessments?: Assessment[];
  subjects: Subject[];
  tasks?: CollegeTask[];
};

const toneColor: Record<string, string> = {
  danger:  'var(--hub-negative)',
  info:    'var(--hub-accent)',
  neutral: 'var(--hub-text)',
};

export function DeadlineList({ assessments = [], subjects, tasks = [] }: DeadlineListProps) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const items = [
    ...tasks.map((task) => ({
      date: task.dueDate,
      id: `task-${task.id}`,
      label: task.title,
      meta: `${subjectMap.get(task.subjectId)?.shortName ?? subjectMap.get(task.subjectId)?.name ?? 'Disciplina'} / ${formatTaskPriority(task.priority)} / ${formatTaskStatus(task.status)}`,
      tone: task.status === 'late' ? 'danger' : 'neutral',
      type: 'Tarefa',
    })),
    ...assessments.map((assessment) => ({
      date: assessment.date,
      id: `assessment-${assessment.id}`,
      label: assessment.title,
      meta: `${subjectMap.get(assessment.subjectId)?.shortName ?? subjectMap.get(assessment.subjectId)?.name ?? 'Disciplina'} / ${formatAssessmentType(assessment.type)}`,
      tone: 'info',
      type: 'Avaliacao',
    })),
  ].sort((first, second) => first.date.localeCompare(second.date));

  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-center" style={{ color: 'var(--hub-subtle)' }}>
        Nenhum prazo cadastrado para acompanhar agora.
      </p>
    );
  }

  return (
    <div>
      {items.map((item) => {
        const color = toneColor[item.tone] ?? toneColor.neutral;

        return (
          <article
            key={item.id}
            className="grid gap-1 py-3 sm:grid-cols-[96px_minmax(0,1fr)]"
            style={{ borderBottom: '1px solid var(--hub-border)' }}
          >
            <div>
              <span
                className="block text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--hub-subtle)' }}
              >
                {item.type}
              </span>
              <strong className="text-sm" style={{ color }}>{formatCollegeDate(item.date)}</strong>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm" style={{ color }}>{item.label}</p>
              <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{item.meta}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
