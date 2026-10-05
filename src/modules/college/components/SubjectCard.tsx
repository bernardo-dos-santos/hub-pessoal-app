import { type ReactNode } from 'react';
import { type Subject } from '../types/subject';
import { formatSubjectStatus } from '../utils/collegeFormatters';

type SubjectCardProps = {
  actions?: ReactNode;
  subject: Subject;
};

export function SubjectCard({ actions, subject }: SubjectCardProps) {
  return (
    <article className="py-4" style={{ borderBottom: '1px solid var(--hub-border)' }}>
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: subject.color ?? 'var(--hub-accent)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{subject.name}</h3>
            {subject.shortName ? (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--hub-subtle)' }}
              >
                {subject.shortName}
              </span>
            ) : null}
            <span
              className="ml-auto text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--hub-subtle)' }}
            >
              {formatSubjectStatus(subject.status)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
            {subject.semester}
            {subject.professor ? ` / ${subject.professor}` : ''}
            {subject.location ? ` / ${subject.location}` : ''}
          </p>
          {subject.aliases?.length ? (
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
              Aliases: {subject.aliases.join(', ')}
            </p>
          ) : null}
          {subject.notes ? (
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{subject.notes}</p>
          ) : null}
          {actions ? (
            <div className="mt-3 flex flex-wrap gap-4">{actions}</div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
