import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { EmptyCollegeState } from '../components/EmptyCollegeState';
import { assessmentService } from '../services/assessmentService';
import { subjectService } from '../services/subjectService';
import { type Assessment } from '../types/assessment';
import { type CollegeAssessmentListStatusFilter, type CollegeListSourceFilter } from '../types/college';
import { formatAssessmentStatus, formatAssessmentType, formatCollegeDate } from '../utils/collegeFormatters';
import { filterCollegeAssessments, sortCollegeAssessments } from '../utils/collegeListFilters';
import { todayKey } from '../utils/collegePeriod';

type AssessmentDraft = {
  date: string;
  grade: string;
  notes: string;
  status: Assessment['status'];
  subjectId: string;
  title: string;
  type: Assessment['type'];
  weight: string;
};

const assessmentStatusFilters: Array<{ label: string; value: CollegeAssessmentListStatusFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Agendadas', value: 'scheduled' },
  { label: 'Realizadas', value: 'completed' },
  { label: 'Perdidas', value: 'missed' },
];

const sourceFilters: Array<{ label: string; value: CollegeListSourceFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Manuais', value: 'manual' },
  { label: 'Captura rapida', value: 'quick_text' },
];

function createDraft(subjectId = '', assessment?: Assessment): AssessmentDraft {
  return {
    date: assessment?.date ?? todayKey(),
    grade: assessment?.grade === undefined ? '' : String(assessment.grade),
    notes: assessment?.notes ?? '',
    status: assessment?.status ?? 'scheduled',
    subjectId: assessment?.subjectId ?? subjectId,
    title: assessment?.title ?? '',
    type: assessment?.type ?? 'exam',
    weight: assessment?.weight === undefined ? '' : String(assessment.weight),
  };
}

export function AssessmentsPage() {
  const subjects = subjectService.listSubjects();
  const firstSubjectId = subjects.find((subject) => subject.status === 'active')?.id ?? subjects[0]?.id ?? '';
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const [assessments, setAssessments] = useState(() => assessmentService.listAssessments());
  const [draft, setDraft] = useState(() => createDraft(firstSubjectId));
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CollegeAssessmentListStatusFilter>(focusId ? 'all' : 'scheduled');
  const [highlightId, setHighlightId] = useState<string | null>(focusId);

  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`assessment-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusId, assessments]);

  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<CollegeListSourceFilter>('all');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const visibleAssessments = sortCollegeAssessments(filterCollegeAssessments(assessments, {
    source: sourceFilter,
    status: statusFilter,
    subjectId: subjectFilter,
  }));

  function refreshAssessments() {
    setAssessments(assessmentService.listAssessments());
  }

  function resetDraft() {
    setEditingAssessmentId(null);
    setDraft(createDraft(firstSubjectId));
  }

  function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        date: draft.date,
        grade: draft.grade ? Number(draft.grade.replace(',', '.')) : undefined,
        notes: draft.notes.trim() || undefined,
        status: draft.status,
        subjectId: draft.subjectId,
        title: draft.title,
        type: draft.type,
        weight: draft.weight ? Number(draft.weight.replace(',', '.')) : undefined,
      };

      if (editingAssessmentId) {
        assessmentService.updateAssessment(editingAssessmentId, input);
        setMessage('Avaliacao atualizada.');
      } else {
        assessmentService.createAssessment(input);
        setMessage('Avaliacao criada.');
      }

      refreshAssessments();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel salvar a avaliacao.');
    }
  }

  function startEditing(assessment: Assessment) {
    setEditingAssessmentId(assessment.id);
    setDraft(createDraft(firstSubjectId, assessment));
    setMessage('');
    setError('');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Avaliações" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Provas, quizzes, praticas e apresentacoes com nota opcional.
      </p>

      {message ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-positive)' }}>{message}</p> : null}
      {error ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <form className="grid gap-5" onSubmit={saveAssessment}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                {editingAssessmentId ? 'Editar avaliacao' : 'Criar avaliacao'}
              </h3>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Sem calculo academico especifico do IFSC nesta versao.
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
              <Field label="Data">
                <input className={inputClass} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </Field>
              <Field label="Tipo">
                <Select className={selectClass} value={draft.type} onChange={(value) => setDraft({ ...draft, type: value as Assessment['type'] })}>
                  <Select.Option value="exam">Prova</Select.Option>
                  <Select.Option value="quiz">Quiz</Select.Option>
                  <Select.Option value="presentation">Apresentacao</Select.Option>
                  <Select.Option value="practical">Pratica</Select.Option>
                  <Select.Option value="other">Outro</Select.Option>
                </Select>
              </Field>
              <Field label="Status">
                <Select className={selectClass} value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as Assessment['status'] })}>
                  <Select.Option value="scheduled">Agendada</Select.Option>
                  <Select.Option value="completed">Realizada</Select.Option>
                  <Select.Option value="missed">Perdida</Select.Option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Peso opcional">
                <input className={inputClass} inputMode="decimal" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })} placeholder="Ex.: 2" />
              </Field>
              <Field label="Nota opcional">
                <input className={inputClass} inputMode="decimal" value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })} placeholder="Ex.: 8,5" />
              </Field>
            </div>
            <Field label="Notas">
              <textarea className={`${inputClass} min-h-20 pt-1`} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Conteudo, sala, observacoes" />
            </Field>
            <div className="flex items-center gap-5">
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="submit"
              >
                {editingAssessmentId ? 'Salvar avaliacao' : 'Criar avaliacao'}
              </button>
              {editingAssessmentId ? <InlineButton label="Cancelar" onClick={resetDraft} /> : null}
            </div>
          </form>
        </Card>

        <div className="grid gap-5">
          <Card>
            <div className="grid gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Status</span>
              <div className="flex flex-wrap gap-1">
                {assessmentStatusFilters.map((filter) => (
                  <button
                    key={filter.value}
                    className="px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{
                      color: statusFilter === filter.value ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                      background: 'none',
                      border: 'none',
                      borderBottom: `1px solid ${statusFilter === filter.value ? 'var(--hub-accent)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Filtrar por disciplina">
                <Select className={selectClass} value={subjectFilter} onChange={setSubjectFilter}>
                  <Select.Option value="all">Todas</Select.Option>
                  {subjects.map((subject) => <Select.Option key={subject.id} value={subject.id}>{subject.name}</Select.Option>)}
                </Select>
              </Field>
              <div className="grid gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Origem</span>
                <div className="flex flex-wrap gap-1">
                  {sourceFilters.map((filter) => (
                    <button
                      key={filter.value}
                      className="px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{
                        color: sourceFilter === filter.value ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                        background: 'none',
                        border: 'none',
                        borderBottom: `1px solid ${sourceFilter === filter.value ? 'var(--hub-accent)' : 'transparent'}`,
                        cursor: 'pointer',
                      }}
                      type="button"
                      onClick={() => setSourceFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              {visibleAssessments.length} avaliacao{visibleAssessments.length === 1 ? '' : 'es'} neste recorte
            </p>
          </Card>

          <Card>
            {visibleAssessments.length === 0 ? (
              <EmptyCollegeState title={getAssessmentEmptyTitle(statusFilter, subjectFilter, sourceFilter)} description={getAssessmentEmptyDescription(statusFilter, subjectFilter, sourceFilter)} />
            ) : (
              visibleAssessments.map((assessment, i) => (
                <article
                  key={assessment.id}
                  id={`assessment-${assessment.id}`}
                  className="py-3"
                  style={{
                    borderBottom: i === visibleAssessments.length - 1 ? 'none' : '1px solid var(--hub-border)',
                    borderLeft: highlightId === assessment.id ? '2px solid var(--hub-accent)' : 'none',
                    paddingLeft: highlightId === assessment.id ? '12px' : '0',
                  }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{assessment.title}</h3>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                        {subjectMap.get(assessment.subjectId)?.name ?? 'Disciplina removida'} / {formatAssessmentType(assessment.type)} / {formatCollegeDate(assessment.date)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--hub-subtle)' }}>
                      {formatAssessmentStatus(assessment.status)}
                    </span>
                  </div>
                  {assessment.grade !== undefined || assessment.weight !== undefined ? (
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                      {assessment.grade !== undefined ? `Nota: ${assessment.grade}` : ''}
                      {assessment.grade !== undefined && assessment.weight !== undefined ? ' / ' : ''}
                      {assessment.weight !== undefined ? `Peso: ${assessment.weight}` : ''}
                    </p>
                  ) : null}
                  {assessment.notes ? (
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{assessment.notes}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-4">
                    <InlineButton label="Editar" onClick={() => startEditing(assessment)} />
                    {assessment.status !== 'completed' ? (
                      <InlineButton label="Marcar realizada" onClick={() => {
                        assessmentService.markAssessmentCompleted(assessment.id, assessment.grade);
                        refreshAssessments();
                        setMessage('Avaliacao marcada como realizada.');
                      }} />
                    ) : null}
                    {assessment.status !== 'missed' ? (
                      <InlineButton label="Marcar perdida" onClick={() => {
                        assessmentService.markAssessmentMissed(assessment.id);
                        refreshAssessments();
                        setMessage('Avaliacao marcada como perdida.');
                      }} />
                    ) : null}
                    {assessment.status !== 'scheduled' ? (
                      <InlineButton label="Reagendar" onClick={() => {
                        assessmentService.reopenAssessment(assessment.id);
                        refreshAssessments();
                        setMessage('Avaliacao voltou para agendada.');
                      }} />
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </Card>
        </div>
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

function getAssessmentEmptyTitle(statusFilter: CollegeAssessmentListStatusFilter, subjectFilter: string, sourceFilter: CollegeListSourceFilter) {
  if (sourceFilter === 'quick_text') return 'Nenhuma avaliacao da captura rapida.';
  if (sourceFilter === 'manual') return 'Nenhuma avaliacao manual neste recorte.';
  if (subjectFilter !== 'all') return 'Nenhuma avaliacao para esta disciplina.';
  return {
    all: 'Nenhuma avaliacao cadastrada.',
    completed: 'Nenhuma avaliacao realizada.',
    missed: 'Nenhuma avaliacao perdida.',
    scheduled: 'Nenhuma avaliacao agendada.',
  }[statusFilter];
}

function getAssessmentEmptyDescription(statusFilter: CollegeAssessmentListStatusFilter, subjectFilter: string, sourceFilter: CollegeListSourceFilter) {
  if (sourceFilter === 'quick_text') return 'Avaliacoes criadas pela captura rapida aparecem aqui depois do salvamento.';
  if (sourceFilter === 'manual') return 'Troque a origem ou cadastre uma avaliacao manual nesta tela.';
  if (subjectFilter !== 'all') return 'Troque a disciplina ou cadastre uma avaliacao ligada a ela.';
  return {
    all: 'Registre provas e apresentacoes para elas aparecerem no dashboard.',
    completed: 'Avaliacoes marcadas como realizadas aparecem aqui.',
    missed: 'Avaliacoes perdidas aparecem aqui para consulta.',
    scheduled: 'Nenhuma prova ou apresentacao futura cadastrada agora.',
  }[statusFilter];
}
