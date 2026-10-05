import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ModuleHeader } from '../../../shared/ui';
import { questionService } from '../services/questionService';
import { errorNotebookService } from '../services/errorNotebookService';
import { MathText } from '../components/MathText';
import type { ErrorNotebookStatus } from '../types/errorNotebook';
import { getStudyTabs } from '../components/studyTabs';
import { ExplainErrorButton } from '../components/ExplainErrorButton';

type Filter = 'all' | 'pending' | 'mastered';

const STATUS_LABEL: Record<ErrorNotebookStatus, string> = {
  pending: 'Pendente',
  reviewing: 'Revisando',
  mastered: 'Dominado',
};

const STATUS_COLOR: Record<ErrorNotebookStatus, string> = {
  pending: 'var(--hub-negative)',
  reviewing: 'var(--hub-warning)',
  mastered: 'var(--hub-positive)',
};

export function ErrorNotebookPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [, forceUpdate] = useState(0);

  const allEntries = errorNotebookService.listEntries();
  const filtered = useMemo(() => {
    if (filter === 'pending') return allEntries.filter((e) => e.status !== 'mastered');
    if (filter === 'mastered') return allEntries.filter((e) => e.status === 'mastered');
    return allEntries;
  }, [allEntries, filter]);

  const bySubject = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const list = map.get(entry.subjectTag) ?? [];
      list.push(entry);
      map.set(entry.subjectTag, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function markMastered(id: string) {
    errorNotebookService.markMastered(id);
    forceUpdate((n) => n + 1);
  }

  function markReviewing(id: string) {
    errorNotebookService.markReviewing(id);
    forceUpdate((n) => n + 1);
  }


  const pendingCount = allEntries.filter((e) => e.status !== 'mastered').length;

  if (allEntries.length === 0) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title="Erros" tabs={getStudyTabs(pendingCount)} />
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Caderno de erros vazio.</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Erros e "Não sei" de simulados e de prática aparecem aqui automaticamente.
          </p>
          <Link
            to="/estudos/simulados"
            className="mt-3 inline-block text-xs font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)' }}
          >
            Fazer um simulado →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Erros" tabs={getStudyTabs(pendingCount)} />
      <div className="space-y-5">
      {/* Drill Mode CTA */}
      {pendingCount > 0 && (
        <Link
          to="/estudos/erros/drill"
          className="flex items-center justify-between py-3 transition-opacity hover:opacity-80"
          style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 40%, transparent)', paddingLeft: '12px' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--hub-accent)' }}>⚡ Drill Mode</p>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Revisão ativa com IA — {pendingCount} erro(s) pendente(s)</p>
          </div>
          <span style={{ color: 'var(--hub-accent)' }}>→</span>
        </Link>
      )}

      {/* Filtros */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--hub-border)' }}>
        {(['pending', 'all', 'mastered'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 text-xs font-medium transition-colors"
            style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${filter === f ? 'var(--hub-accent)' : 'transparent'}`,
              color: filter === f ? 'var(--hub-accent)' : 'var(--hub-subtle)',
              cursor: 'pointer',
              marginBottom: '-1px',
            }}
          >
            {f === 'pending'
              ? `Pendentes · ${allEntries.filter((e) => e.status !== 'mastered').length}`
              : f === 'all'
              ? 'Todos'
              : 'Dominados'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {filter === 'pending' ? 'Nenhum erro pendente. 🎉' : 'Nenhum item nesta categoria.'}
        </p>
      )}

      {bySubject.map(([subject, entries]) => (
        <div key={subject} className="space-y-0">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
            {subject} · {entries.length}
          </h2>

          {entries.map((entry) => {
            const question = questionService.getById(entry.questionId);
            if (!question) return null;

            return (
              <div
                key={entry.id}
                className="space-y-3 py-4"
                style={{ borderBottom: '1px solid var(--hub-border)' }}
              >
                {/* Cabeçalho do card */}
                <div className="flex items-start justify-between gap-2">
                  <MathText content={question.statement} className="text-sm leading-snug" style={{ color: 'var(--hub-text)' }} />
                  <span
                    className="shrink-0 text-[10px] font-semibold"
                    style={{ color: STATUS_COLOR[entry.status] }}
                  >
                    {STATUS_LABEL[entry.status]}
                  </span>
                </div>

                {/* Alternativas */}
                <div className="space-y-1">
                  {question.options.map((o) => (
                    <div
                      key={o.letter}
                      className="text-xs"
                      style={{
                        color: o.letter === question.correctOption
                          ? 'var(--hub-positive)'
                          : o.letter === entry.chosenOption
                          ? 'var(--hub-negative)'
                          : 'var(--hub-subtle)',
                        fontWeight: o.letter === question.correctOption ? 600 : 400,
                        textDecoration: o.letter === entry.chosenOption && o.letter !== question.correctOption ? 'line-through' : 'none',
                        opacity: o.letter === entry.chosenOption && o.letter !== question.correctOption ? 0.7 : 1,
                      }}
                    >
                      {o.letter}) <MathText inline content={o.text} />
                    </div>
                  ))}
                </div>

                {entry.reason === 'unknown' && (
                  <p className="text-[10px] italic" style={{ color: 'var(--hub-subtle)' }}>Não respondida / "Não sei"</p>
                )}
                {entry.timesFailed > 1 && (
                  <p className="text-[10px]" style={{ color: 'color-mix(in srgb, var(--hub-negative) 70%, transparent)' }}>{entry.timesFailed}× errada</p>
                )}

                <ExplainErrorButton question={question} chosenOption={entry.chosenOption} />

                {/* Ações */}
                <div className="flex gap-4 pt-1">
                  {entry.status !== 'mastered' && (
                    <button
                      onClick={() => markMastered(entry.id)}
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Dominar ✓
                    </button>
                  )}
                  {entry.status === 'pending' && (
                    <button
                      onClick={() => markReviewing(entry.id)}
                      className="text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-warning)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Revisar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
