import { type FormEvent, type ReactNode, useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { EmptyCollegeState } from '../components/EmptyCollegeState';
import { gradeService } from '../services/gradeService';
import { subjectService } from '../services/subjectService';
import { type Grade } from '../types/grade';
import { buildAssessmentStatuses, calcSubjectGradeSummary } from '../utils/collegeCalculations';
import { formatCollegeDate, formatGradeValue } from '../utils/collegeFormatters';

type GradeDraft = {
  date: string;
  maxValue: string;
  notes: string;
  subjectId: string;
  title: string;
  value: string;
  weight: string;
};

function createDraft(subjectId = '', grade?: Grade): GradeDraft {
  return {
    date: grade?.date ?? '',
    maxValue: grade?.maxValue === undefined ? '' : String(grade.maxValue),
    notes: grade?.notes ?? '',
    subjectId: grade?.subjectId ?? subjectId,
    title: grade?.title ?? '',
    value: grade?.value === undefined ? '' : String(grade.value),
    weight: grade?.weight === undefined ? '' : String(grade.weight),
  };
}

export function GradesPage() {
  const subjects = subjectService.listSubjects();
  const firstSubjectId = subjects.find((subject) => subject.status === 'active')?.id ?? subjects[0]?.id ?? '';
  const [grades, setGrades] = useState(() => gradeService.listGrades());
  const [draft, setDraft] = useState(() => createDraft(firstSubjectId));
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const gradesBySubject = subjects.map((subject) => ({
    grades: grades.filter((grade) => grade.subjectId === subject.id),
    subject,
  })).filter((group) => group.grades.length > 0);

  function refreshGrades() {
    setGrades(gradeService.listGrades());
  }

  function resetDraft() {
    setEditingGradeId(null);
    setDraft(createDraft(firstSubjectId));
  }

  function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        date: draft.date || undefined,
        maxValue: draft.maxValue ? Number(draft.maxValue.replace(',', '.')) : undefined,
        notes: draft.notes.trim() || undefined,
        subjectId: draft.subjectId,
        title: draft.title,
        value: Number(draft.value.replace(',', '.')),
        weight: draft.weight ? Number(draft.weight.replace(',', '.')) : undefined,
      };

      if (editingGradeId) {
        gradeService.updateGrade(editingGradeId, input);
        setMessage('Nota atualizada.');
      } else {
        gradeService.createGrade(input);
        setMessage('Nota cadastrada.');
      }

      refreshGrades();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel salvar a nota.');
    }
  }

  function startEditing(grade: Grade) {
    setEditingGradeId(grade.id);
    setDraft(createDraft(firstSubjectId, grade));
    setMessage('');
    setError('');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Notas" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Cadastro simples de notas e media basica, sem regra especifica do IFSC.
      </p>

      {message ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-positive)' }}>{message}</p> : null}
      {error ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
        <Card>
          <form className="grid gap-5" onSubmit={saveGrade}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                {editingGradeId ? 'Editar nota' : 'Cadastrar nota'}
              </h3>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Peso e valor maximo sao opcionais.
              </p>
            </div>
            <Field label="Titulo">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: P1" />
            </Field>
            <Field label="Disciplina">
              <Select className={selectClass} value={draft.subjectId} onChange={(value) => setDraft({ ...draft, subjectId: value })}>
                <Select.Option value="">Escolha</Select.Option>
                {subjects.map((subject) => <Select.Option key={subject.id} value={subject.id}>{subject.name}</Select.Option>)}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Nota">
                <input className={inputClass} inputMode="decimal" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} placeholder="8,5" />
              </Field>
              <Field label="Maximo">
                <input className={inputClass} inputMode="decimal" value={draft.maxValue} onChange={(event) => setDraft({ ...draft, maxValue: event.target.value })} placeholder="10" />
              </Field>
              <Field label="Peso">
                <input className={inputClass} inputMode="decimal" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })} placeholder="Opcional" />
              </Field>
            </div>
            <Field label="Data">
              <input className={inputClass} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </Field>
            <Field label="Notas">
              <textarea className={`${inputClass} min-h-24 pt-1`} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Observacoes" />
            </Field>
            <div className="flex items-center gap-5">
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="submit"
              >
                {editingGradeId ? 'Salvar nota' : 'Cadastrar nota'}
              </button>
              {editingGradeId ? <InlineButton label="Cancelar" onClick={resetDraft} /> : null}
            </div>
          </form>
        </Card>

        {grades.length === 0 ? (
          <Card><EmptyCollegeState title="Nenhuma nota cadastrada." description="Adicione notas por disciplina para ver a media." /></Card>
        ) : (
          <div className="grid gap-5">
            {gradesBySubject.map(({ grades: subjectGrades, subject }) => {
              const plan = subject.parsedPlan;
              const passing = plan?.passingGrade ?? 6;
              const summary = calcSubjectGradeSummary(subjectGrades, plan, passing);
              const projColor = summary.isPassing ? 'var(--hub-positive)' : summary.neededToPass !== null ? 'var(--hub-warning)' : 'var(--hub-negative)';
              const statusText = summary.isComplete && summary.isPassing
                ? 'aprovado'
                : summary.isPassing
                ? 'aprovando'
                : summary.neededToPass !== null
                ? `precisa ${summary.neededToPass.toFixed(1)} nas restantes`
                : summary.projectedFinal !== null
                ? 'impossível por média'
                : '';

              return (
                <Card key={subject.id}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{subject.name}</h3>
                      {plan?.finalFormula ? (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: 'var(--hub-subtle)' }}>
                          {plan.finalFormula} · mín. {passing}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                          {subjectGrades.length} nota{subjectGrades.length === 1 ? '' : 's'}
                        </p>
                      )}
                      {subject.attendance && (() => {
                        const { absences, totalAllowed } = subject.attendance;
                        const remaining = totalAllowed !== null ? totalAllowed - absences : null;
                        const attColor = remaining === null ? 'var(--hub-subtle)'
                          : remaining <= 0 ? 'var(--hub-negative)'
                          : remaining <= 2 ? 'var(--hub-warning)'
                          : 'var(--hub-subtle)';
                        return (
                          <p className="mt-0.5 text-[10px]" style={{ color: attColor }}>
                            {absences} falta{absences === 1 ? '' : 's'}
                            {totalAllowed !== null ? ` / ${totalAllowed} máximo` : ''}
                            {remaining !== null && remaining <= 2 && remaining > 0 ? ` · ${remaining} restante${remaining === 1 ? '' : 's'}` : ''}
                            {remaining !== null && remaining <= 0 ? ' · limite atingido' : ''}
                          </p>
                        );
                      })()}
                    </div>
                    {summary.projectedFinal !== null && (
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-light tabular-nums leading-none" style={{ color: projColor, letterSpacing: '-0.02em' }}>
                          {summary.projectedFinal.toFixed(2).replace('.', ',')}
                        </p>
                        {statusText && (
                          <p className="mt-1 text-[10px]" style={{ color: projColor }}>{statusText}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {plan ? (
                    <div>
                      {buildAssessmentStatuses(subjectGrades, plan, passing).map((av) => {
                        const statusColor =
                          av.status === 'ok' ? 'var(--hub-positive)'
                          : av.status === 'recovered' ? 'var(--hub-positive)'
                          : av.status === 'pending_recovery' ? 'var(--hub-negative)'
                          : 'var(--hub-subtle)';
                        const statusTag =
                          av.status === 'ok' ? null
                          : av.status === 'recovered' ? 'rec.'
                          : av.status === 'pending_recovery' ? 'pendente rec.'
                          : 'sem nota';

                        return (
                          <div
                            key={av.resultsKey}
                            className="flex items-center justify-between gap-3 py-2.5"
                            style={{ borderBottom: '1px solid var(--hub-border)' }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm" style={{ color: av.status === 'not_graded' ? 'var(--hub-subtle)' : 'var(--hub-text)' }}>
                                {av.label}
                              </p>
                              <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                                {`Peso ${Math.round(av.weight * 100)}%`}
                                {statusTag && (
                                  <span className="ml-2 font-semibold uppercase tracking-widest text-[10px]" style={{ color: statusColor }}>
                                    {statusTag}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              {av.status === 'recovered' ? (
                                <span className="text-sm tabular-nums" style={{ color: 'var(--hub-subtle)', textDecoration: 'line-through' }}>
                                  {av.value?.toFixed(1).replace('.', ',')}
                                </span>
                              ) : null}
                              <strong
                                className="text-sm tabular-nums"
                                style={{ color: av.effectiveValue !== null && av.effectiveValue >= passing ? 'var(--hub-positive)' : av.status === 'not_graded' ? 'var(--hub-disabled)' : 'var(--hub-negative)' }}
                              >
                                {av.effectiveValue !== null ? av.effectiveValue.toFixed(1).replace('.', ',') : '—'}
                              </strong>
                            </div>
                          </div>
                        );
                      })}

                      {subjectGrades.filter((g) => {
                        if (g.isRecovery) return false;
                        return !plan.assessments.some(
                          (a) =>
                            g.sigaaColumn?.toLowerCase() === a.resultsKey.toLowerCase() ||
                            g.title.toLowerCase() === a.label.toLowerCase(),
                        );
                      }).map((grade) => (
                        <div
                          key={grade.id}
                          className="flex items-center justify-between gap-3 py-2.5"
                          style={{ borderBottom: '1px solid var(--hub-border)' }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>{grade.title}</p>
                            <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>fora do plano</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <strong className="text-sm tabular-nums" style={{ color: 'var(--hub-muted)' }}>
                              {formatGradeValue(grade.value, grade.maxValue)}
                            </strong>
                            <InlineButton label="Editar" onClick={() => startEditing(grade)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {subjectGrades.map((grade) => {
                        const isRec = grade.isRecovery;
                        const isLow = !isRec && grade.value < passing;
                        const gradeColor = isRec ? 'var(--hub-warning)' : isLow ? 'var(--hub-negative)' : 'var(--hub-text)';
                        const weightPct = grade.weight ? `Peso ${Math.round(grade.weight * 100)}%` : '';
                        const datePart = grade.date ? formatCollegeDate(grade.date) : '';
                        const subtitle = [weightPct, datePart].filter(Boolean).join(' · ');

                        return (
                          <div
                            key={grade.id}
                            className="flex items-center justify-between gap-3 py-2.5"
                            style={{ borderBottom: '1px solid var(--hub-border)' }}
                          >
                            <div className="min-w-0">
                              <p className="text-sm" style={{ color: gradeColor }}>
                                {grade.title}
                                {isRec && (
                                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest" style={{ opacity: 0.7 }}>
                                    rec.
                                  </span>
                                )}
                              </p>
                              {subtitle && (
                                <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                                  {subtitle}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <strong className="text-sm tabular-nums" style={{ color: gradeColor }}>
                                {formatGradeValue(grade.value, grade.maxValue)}
                              </strong>
                              <InlineButton label="Editar" onClick={() => startEditing(grade)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {summary.neededToPass !== null && (
                    <p className="mt-3 text-xs" style={{ color: 'var(--hub-warning)' }}>
                      Para passar (mín. {passing}): precisa de {summary.neededToPass.toFixed(1)} nas avaliações restantes.
                    </p>
                  )}
                  {!summary.isPassing && summary.neededToPass === null && summary.isComplete && (
                    <p className="mt-3 text-xs" style={{ color: 'var(--hub-negative)' }}>
                      Resultado insuficiente — verificar recuperação.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="space-y-2">
      <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function InlineButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      className="text-xs transition-opacity hover:opacity-70"
      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
