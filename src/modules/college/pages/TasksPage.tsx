import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { EmptyCollegeState } from '../components/EmptyCollegeState';
import { subjectService } from '../services/subjectService';
import { taskService } from '../services/taskService';
import { type CollegeListSourceFilter, type CollegeTaskListStatusFilter } from '../types/college';
import { type CollegeTask } from '../types/task';
import { formatCollegeDate, formatTaskPriority, formatTaskStatus } from '../utils/collegeFormatters';
import { filterCollegeTasks, sortCollegeTasks } from '../utils/collegeListFilters';
import { todayKey } from '../utils/collegePeriod';

type TaskDraft = {
  description: string;
  dueDate: string;
  grade: string;
  priority: CollegeTask['priority'];
  status: CollegeTask['status'];
  subjectId: string;
  title: string;
};

const taskStatusFilters: Array<{ label: string; value: CollegeTaskListStatusFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Abertas', value: 'open' },
  { label: 'Atrasadas', value: 'late' },
  { label: 'Concluidas', value: 'done' },
  { label: 'Canceladas', value: 'canceled' },
];

const sourceFilters: Array<{ label: string; value: CollegeListSourceFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Manuais', value: 'manual' },
  { label: 'Captura rapida', value: 'quick_text' },
];

function createDraft(subjectId = '', task?: CollegeTask): TaskDraft {
  return {
    description: task?.description ?? '',
    dueDate: task?.dueDate ?? todayKey(),
    grade: task?.grade === undefined ? '' : String(task.grade),
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'pending',
    subjectId: task?.subjectId ?? subjectId,
    title: task?.title ?? '',
  };
}

export function TasksPage() {
  const subjects = subjectService.listSubjects();
  const activeSubjects = subjects.filter((subject) => subject.status === 'active');
  const firstSubjectId = activeSubjects[0]?.id ?? subjects[0]?.id ?? '';
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');
  const [tasks, setTasks] = useState(() => taskService.listTasks());
  const [draft, setDraft] = useState(() => createDraft(firstSubjectId));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<CollegeListSourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<CollegeTaskListStatusFilter>(focusId ? 'all' : 'open');
  const [highlightId, setHighlightId] = useState<string | null>(focusId);

  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`task-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusId, tasks]);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const visibleTasks = sortCollegeTasks(filterCollegeTasks(tasks, { source: sourceFilter, status: statusFilter, subjectId: subjectFilter }));

  function refreshTasks() {
    setTasks(taskService.listTasks());
  }

  function resetDraft() {
    setEditingTaskId(null);
    setDraft(createDraft(firstSubjectId));
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        description: draft.description.trim() || undefined,
        dueDate: draft.dueDate,
        grade: draft.grade ? Number(draft.grade.replace(',', '.')) : undefined,
        priority: draft.priority,
        status: draft.status,
        subjectId: draft.subjectId,
        title: draft.title,
      };

      if (editingTaskId) {
        taskService.updateTask(editingTaskId, input);
        setMessage('Tarefa atualizada.');
      } else {
        taskService.createTask(input);
        setMessage('Tarefa criada.');
      }

      refreshTasks();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel salvar a tarefa.');
    }
  }

  function startEditing(task: CollegeTask) {
    setEditingTaskId(task.id);
    setDraft(createDraft(firstSubjectId, task));
    setMessage('');
    setError('');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Tarefas e trabalhos" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Prazos manuais com status simples e atraso detectado automaticamente.
      </p>

      {message ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-positive)' }}>{message}</p> : null}
      {error ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <form className="grid gap-5" onSubmit={saveTask}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                {editingTaskId ? 'Editar tarefa' : 'Criar tarefa'}
              </h3>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Use para trabalhos, listas, leituras obrigatorias e entregas.
              </p>
            </div>
            <Field label="Titulo">
              <input className={inputClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Lista 2" />
            </Field>
            <Field label="Disciplina">
              <Select className={selectClass} value={draft.subjectId} onChange={(value) => setDraft({ ...draft, subjectId: value })}>
                <Select.Option value="">Escolha</Select.Option>
                {subjects.map((subject) => <Select.Option key={subject.id} value={subject.id}>{subject.name}</Select.Option>)}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Prazo">
                <input className={inputClass} type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
              </Field>
              <Field label="Prioridade">
                <Select className={selectClass} value={draft.priority} onChange={(value) => setDraft({ ...draft, priority: value as CollegeTask['priority'] })}>
                  <Select.Option value="low">Baixa</Select.Option>
                  <Select.Option value="medium">Media</Select.Option>
                  <Select.Option value="high">Alta</Select.Option>
                </Select>
              </Field>
              <Field label="Status">
                <Select className={selectClass} value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as CollegeTask['status'] })}>
                  <Select.Option value="pending">Pendente</Select.Option>
                  <Select.Option value="in_progress">Em andamento</Select.Option>
                  <Select.Option value="done">Concluida</Select.Option>
                  <Select.Option value="late">Atrasada</Select.Option>
                  <Select.Option value="canceled">Cancelada</Select.Option>
                </Select>
              </Field>
            </div>
            <Field label="Nota opcional">
              <input className={inputClass} inputMode="decimal" value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })} placeholder="Ex.: 8,5" />
            </Field>
            <Field label="Descricao">
              <textarea className={`${inputClass} min-h-20 pt-1`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Detalhes do trabalho" />
            </Field>
            <div className="flex items-center gap-5">
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="submit"
              >
                {editingTaskId ? 'Salvar tarefa' : 'Criar tarefa'}
              </button>
              {editingTaskId ? <InlineButton label="Cancelar" onClick={resetDraft} /> : null}
            </div>
          </form>
        </Card>

        <div className="grid gap-5">
          <Card>
            <div className="grid gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
                Status
              </span>
              <div className="flex flex-wrap gap-1">
                {taskStatusFilters.map((filter) => (
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
              {visibleTasks.length} tarefa{visibleTasks.length === 1 ? '' : 's'} neste recorte
            </p>
          </Card>

          <Card>
            {visibleTasks.length === 0 ? (
              <EmptyCollegeState title={getTaskEmptyTitle(statusFilter, subjectFilter, sourceFilter)} description={getTaskEmptyDescription(statusFilter, subjectFilter, sourceFilter)} />
            ) : (
              visibleTasks.map((task, i) => (
                <article
                  key={task.id}
                  id={`task-${task.id}`}
                  className="py-3"
                  style={{
                    borderBottom: i === visibleTasks.length - 1 ? 'none' : '1px solid var(--hub-border)',
                    borderLeft: highlightId === task.id ? '2px solid var(--hub-accent)' : 'none',
                    paddingLeft: highlightId === task.id ? '12px' : '0',
                  }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>{task.title}</h3>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                        {subjectMap.get(task.subjectId)?.name ?? 'Disciplina removida'} / {formatCollegeDate(task.dueDate)} / {formatTaskPriority(task.priority)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs font-medium"
                      style={{ color: task.status === 'late' ? 'var(--hub-negative)' : 'var(--hub-subtle)' }}
                    >
                      {formatTaskStatus(task.status)}
                    </span>
                  </div>
                  {task.description ? (
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>{task.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-4">
                    <InlineButton label="Editar" onClick={() => startEditing(task)} />
                    {task.status !== 'done' ? (
                      <InlineButton label="Concluir" onClick={() => {
                        taskService.markTaskDone(task.id);
                        refreshTasks();
                        setMessage('Tarefa concluida.');
                      }} />
                    ) : null}
                    {task.status === 'done' || task.status === 'canceled' ? (
                      <InlineButton label="Reabrir" onClick={() => {
                        taskService.reopenTask(task.id);
                        refreshTasks();
                        setMessage('Tarefa reaberta.');
                      }} />
                    ) : null}
                    {task.status !== 'done' && task.status !== 'canceled' ? (
                      <InlineButton label="Cancelar" onClick={() => {
                        taskService.cancelTask(task.id);
                        refreshTasks();
                        setMessage('Tarefa cancelada.');
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

function getTaskEmptyTitle(statusFilter: CollegeTaskListStatusFilter, subjectFilter: string, sourceFilter: CollegeListSourceFilter) {
  if (sourceFilter === 'quick_text') return 'Nenhuma tarefa da captura rapida.';
  if (sourceFilter === 'manual') return 'Nenhuma tarefa manual neste recorte.';
  if (subjectFilter !== 'all') return 'Nenhuma tarefa para esta disciplina.';
  return {
    all: 'Nenhuma tarefa cadastrada.',
    canceled: 'Nenhuma tarefa cancelada.',
    done: 'Nenhuma tarefa concluida.',
    late: 'Nenhuma tarefa atrasada.',
    open: 'Nenhuma tarefa aberta.',
  }[statusFilter];
}

function getTaskEmptyDescription(statusFilter: CollegeTaskListStatusFilter, subjectFilter: string, sourceFilter: CollegeListSourceFilter) {
  if (sourceFilter === 'quick_text') return 'Tarefas criadas pela captura rapida aparecem aqui depois do salvamento.';
  if (sourceFilter === 'manual') return 'Troque a origem ou crie uma tarefa manual nesta tela.';
  if (subjectFilter !== 'all') return 'Troque a disciplina ou crie uma nova tarefa ligada a ela.';
  return {
    all: 'Crie prazos para acompanhar entregas e evitar esquecimentos.',
    canceled: 'Tarefas canceladas aparecem aqui para consulta.',
    done: 'Conclua tarefas abertas para formar seu historico do semestre.',
    late: 'Boa. Nenhuma tarefa vencida precisa de acao agora.',
    open: 'Nada aberto por enquanto. Crie uma tarefa quando surgir um novo prazo.',
  }[statusFilter];
}
