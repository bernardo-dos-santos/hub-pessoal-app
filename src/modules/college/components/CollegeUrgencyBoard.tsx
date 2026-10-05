import { Link } from 'react-router-dom';
import { type CollegeUrgencyGroupKey, type CollegeUrgencyGroups, type CollegeUrgencyItem } from '../types/college';
import { type Subject } from '../types/subject';
import { formatCollegeDate } from '../utils/collegeFormatters';

type CollegeUrgencyBoardProps = {
  groups: CollegeUrgencyGroups;
  subjects: Subject[];
};

const groupContent: Record<CollegeUrgencyGroupKey, {
  description: string;
  emptyText: string;
  label: string;
  color: string;
}> = {
  overdue: {
    description: 'Prazos que já passaram e ainda precisam de ação.',
    emptyText: 'Nada atrasado por enquanto.',
    label: 'Atrasado',
    color: 'var(--hub-negative)',
  },
  today: {
    description: 'O que vence ou acontece hoje.',
    emptyText: 'Nenhuma entrega ou avaliação para hoje.',
    label: 'Hoje',
    color: 'var(--hub-warning)',
  },
  thisWeek: {
    description: 'Próximos 7 dias.',
    emptyText: 'Semana tranquila até agora.',
    label: 'Esta semana',
    color: 'var(--hub-accent)',
  },
  upcoming: {
    description: 'Depois da janela da semana.',
    emptyText: 'Nada em breve neste filtro.',
    label: 'Em breve',
    color: 'var(--hub-subtle)',
  },
};

const groupOrder: CollegeUrgencyGroupKey[] = ['overdue', 'today', 'thisWeek', 'upcoming'];

export function CollegeUrgencyBoard({ groups, subjects }: CollegeUrgencyBoardProps) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {groupOrder.map((groupKey) => {
        const content = groupContent[groupKey];
        const items = groups[groupKey];

        return (
          <article key={groupKey}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: content.color }} />
                  <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: content.color }}>
                    {content.label}
                  </h2>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                    {items.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>{content.description}</p>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                {content.emptyText}
              </p>
            ) : (
              <div>
                {items.slice(0, 5).map((item) => (
                  <UrgencyItemRow
                    key={item.id}
                    item={item}
                    subjectName={subjectMap.get(item.subjectId)?.shortName ?? subjectMap.get(item.subjectId)?.name ?? 'Disciplina'}
                    accentColor={content.color}
                  />
                ))}
                {items.length > 5 ? (
                  <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                    +{items.length - 5} item{items.length - 5 === 1 ? '' : 's'} nesta seção
                  </p>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function formatItemDate(item: CollegeUrgencyItem): string {
  const dateOnly = item.date.split('T')[0];
  const formatted = formatCollegeDate(dateOnly);
  if (item.kind === 'task' && item.date.includes('T')) {
    const time = item.date.split('T')[1]?.substring(0, 5);
    if (time && time !== '00:00') return `${formatted} às ${time}`;
  }
  return formatted;
}

function UrgencyItemRow({ accentColor, item, subjectName }: { accentColor: string; item: CollegeUrgencyItem; subjectName: string }) {
  const kindLabel = item.kind === 'task' ? 'Tarefa' : 'Avaliação';
  const priorityColor = item.priority === 'high'
    ? 'var(--hub-negative)'
    : item.priority === 'medium'
      ? 'var(--hub-warning)'
      : 'var(--hub-subtle)';

  const to = item.kind === 'task'
    ? `/faculdade/tarefas?focus=${item.sourceId}`
    : `/faculdade/avaliacoes?focus=${item.sourceId}`;

  return (
    <Link
      to={to}
      className="flex items-start justify-between gap-3 py-2.5 transition-opacity hover:opacity-80"
      style={{ borderBottom: '1px solid var(--hub-border)' }}
    >
      <div className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
          {kindLabel} / {formatItemDate(item)}
        </span>
        <p className="mt-0.5 text-sm font-semibold" style={{ color: accentColor }}>{item.title}</p>
        <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          {subjectName} / {item.detail}
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium" style={{ color: priorityColor }}>
        {item.priority === 'high' ? 'Alta' : item.priority === 'medium' ? 'Média' : 'Baixa'}
      </span>
    </Link>
  );
}
