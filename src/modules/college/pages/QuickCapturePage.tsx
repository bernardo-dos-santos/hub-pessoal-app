import { type FormEvent, type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { assessmentService } from '../services/assessmentService';
import { subjectService } from '../services/subjectService';
import { taskService } from '../services/taskService';
import { type CollegeQuickCaptureCreatedItem, type CollegeQuickCaptureDraft } from '../types/college';
import { type Assessment } from '../types/assessment';
import {
  getCollegeQuickCaptureDraftStatus,
  parseCollegeQuickCaptureText,
  summarizeCollegeQuickCaptureDrafts,
  validateCollegeQuickCaptureDraft,
} from '../utils/collegeQuickCapture';
import { addDays, todayKey } from '../utils/collegePeriod';

const sampleText = [
  'POO - trabalho de API para 28/05',
  'Calc prova AV2 dia 10/06 peso 4',
  'BD lista 3 entregar sexta',
  'Redes relatorio em grupo ate amanha',
  'ES seminario proxima sexta',
  'Banco atividade postar no Moodle semana que vem',
].join('\n');

const statusColor: Record<ReturnType<typeof getCollegeQuickCaptureDraftStatus>, string> = {
  ignored: 'var(--hub-subtle)',
  incomplete: 'var(--hub-warning)',
  ready: 'var(--hub-positive)',
};

const statusLabel: Record<ReturnType<typeof getCollegeQuickCaptureDraftStatus>, string> = {
  ignored: 'Ignorado',
  incomplete: 'Incompleto',
  ready: 'Pronto',
};

export function QuickCapturePage() {
  const subjects = subjectService.listSubjects();
  const [rawText, setRawText] = useState('');
  const [drafts, setDrafts] = useState<CollegeQuickCaptureDraft[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recentlyCreatedItems, setRecentlyCreatedItems] = useState<CollegeQuickCaptureCreatedItem[]>([]);
  const summary = summarizeCollegeQuickCaptureDrafts(drafts);
  const firstSubject = subjects[0];
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  const recentTasks = recentlyCreatedItems.filter((item) => item.type === 'task').length;
  const recentAssessments = recentlyCreatedItems.length - recentTasks;

  function parseText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setRecentlyCreatedItems([]);

    const result = parseCollegeQuickCaptureText({ subjects, text: rawText });
    setDrafts(result.drafts);

    if (result.drafts.length === 0) {
      setMessage('Nenhum rascunho encontrado. Tente colar uma linha por tarefa ou avaliacao.');
      return;
    }

    setMessage(`${result.drafts.length} rascunho${result.drafts.length === 1 ? '' : 's'} encontrado${result.drafts.length === 1 ? '' : 's'}. Revise antes de salvar.`);
  }

  function updateDraft(id: string, updates: Partial<CollegeQuickCaptureDraft>) {
    setDrafts((currentDrafts) => currentDrafts.map((d) => {
      if (d.id !== id) return d;
      const nextDraft = { ...d, ...updates };
      const validation = validateCollegeQuickCaptureDraft(nextDraft);
      return { ...nextDraft, ...validation };
    }));
  }

  function saveDrafts() {
    setError('');
    const draftsToSave = drafts.filter((d) => getCollegeQuickCaptureDraftStatus(d) === 'ready');
    const tasksToSave = draftsToSave.filter((d) => d.type === 'task').length;
    const assessmentsToSave = draftsToSave.length - tasksToSave;
    const ignoredCount = drafts.filter((d) => getCollegeQuickCaptureDraftStatus(d) === 'ignored').length;
    const incompleteCount = drafts.filter((d) => getCollegeQuickCaptureDraftStatus(d) === 'incomplete').length;

    if (draftsToSave.length === 0) {
      setError('Nenhum rascunho pronto para salvar. Corrija disciplina, data e titulo dos itens incompletos.');
      return;
    }

    try {
      const createdItems: CollegeQuickCaptureCreatedItem[] = [];

      draftsToSave.forEach((d) => {
        if (d.type === 'assessment') {
          const assessment = assessmentService.createAssessment({
            date: d.date,
            notes: d.notes,
            source: d.source,
            status: 'scheduled',
            subjectId: d.subjectId,
            title: d.title,
            type: d.assessmentType ?? 'other',
            weight: d.weight,
          });
          createdItems.push({ date: assessment.date, id: assessment.id, subjectId: assessment.subjectId, title: assessment.title, type: 'assessment' });
          return;
        }

        const task = taskService.createTask({
          description: d.notes,
          dueDate: d.date,
          priority: 'medium',
          source: d.source,
          status: 'pending',
          subjectId: d.subjectId,
          title: d.title,
        });
        createdItems.push({ date: task.dueDate, id: task.id, subjectId: task.subjectId, title: task.title, type: 'task' });
      });

      setRecentlyCreatedItems(createdItems);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar os rascunhos.');
      return;
    }

    setDrafts((currentDrafts) => currentDrafts.filter((d) => getCollegeQuickCaptureDraftStatus(d) !== 'ready'));
    setMessage([
      `${draftsToSave.length} item${draftsToSave.length === 1 ? '' : 's'} salvo${draftsToSave.length === 1 ? '' : 's'}.`,
      `${tasksToSave} tarefa${tasksToSave === 1 ? '' : 's'} e ${assessmentsToSave} avaliacao${assessmentsToSave === 1 ? '' : 'es'} criadas.`,
      `${ignoredCount} ignorado${ignoredCount === 1 ? '' : 's'} e ${incompleteCount} incompleto${incompleteCount === 1 ? '' : 's'} ficaram na revisao.`,
    ].join(' '));
  }

  function startNewCapture() {
    setRawText('');
    setDrafts([]);
    setRecentlyCreatedItems([]);
    setMessage('');
    setError('');
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Captura rápida" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Cole mensagens de professores, anotacoes ou lembretes. Use uma pendencia por linha, revise antes de salvar e lembre que apelidos de disciplinas melhoram a deteccao.
      </p>

      {message ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-positive)' }}>{message}</p> : null}
      {error ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <Card className="xl:sticky xl:top-4 xl:self-start">
          <form className="grid gap-5" onSubmit={parseText}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Texto livre</h3>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Use uma linha por item. Nada sera salvo automaticamente; os rascunhos sempre passam por revisao.
              </p>
            </div>
            <textarea
              className="min-h-56 w-full bg-transparent text-sm outline-none"
              style={{ border: 'none', borderBottom: '1px solid var(--hub-border-strong)', resize: 'vertical', paddingBottom: '8px' }}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={sampleText}
            />
            <div className="flex flex-wrap gap-4">
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="submit"
              >
                Gerar rascunhos
              </button>
              <InlineButton label="Usar exemplo" onClick={() => setRawText(sampleText)} />
              <InlineButton label="Limpar texto" onClick={() => setRawText('')} />
            </div>
          </form>
        </Card>

        <div className="grid gap-5">
          {recentlyCreatedItems.length > 0 ? (
            <Card style={{ borderLeft: '2px solid var(--hub-positive)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-positive)' }}>
                Itens salvos nesta captura
              </h3>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                {recentlyCreatedItems.length} item{recentlyCreatedItems.length === 1 ? '' : 's'} salvo{recentlyCreatedItems.length === 1 ? '' : 's'}: {recentTasks} tarefa{recentTasks === 1 ? '' : 's'}, {recentAssessments} avaliacao{recentAssessments === 1 ? '' : 'es'}.
              </p>
              <div className="mt-3">
                {recentlyCreatedItems.map((item, i) => (
                  <div key={`${item.type}-${item.id}`} className="py-2" style={{ borderBottom: i === recentlyCreatedItems.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: item.type === 'assessment' ? 'var(--hub-accent)' : 'var(--hub-positive)' }}>
                        {item.type === 'assessment' ? 'Avaliacao' : 'Tarefa'}
                      </span>
                      <strong className="text-sm" style={{ color: 'var(--hub-text)' }}>{item.title}</strong>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                      {subjectMap.get(item.subjectId)?.name ?? 'Disciplina removida'} / {item.date}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                {recentTasks > 0 ? <ActionLink to="/faculdade/tarefas" label="Ver tarefas criadas" /> : null}
                {recentAssessments > 0 ? <ActionLink to="/faculdade/avaliacoes" label="Ver avaliacoes criadas" /> : null}
                <ActionLink to="/faculdade" label="Ir para dashboard" />
                <InlineButton label="Nova captura" onClick={startNewCapture} />
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Revisao dos rascunhos</h3>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                  Itens incompletos ficam sinalizados e nao sao salvos.
                </p>
              </div>
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-positive)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="button"
                onClick={saveDrafts}
              >
                Salvar prontos
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-0 sm:grid-cols-4">
              <SummaryChip label="Prontos" value={summary.ready} color="var(--hub-positive)" />
              <SummaryChip label="Incompletos" value={summary.incomplete} color="var(--hub-warning)" />
              <SummaryChip label="Ignorados" value={summary.ignored} color="var(--hub-subtle)" />
              <SummaryChip label="Total" value={summary.total} color="var(--hub-muted)" last />
            </div>
          </Card>

          {drafts.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-sm leading-6" style={{ color: 'var(--hub-subtle)' }}>
                Os rascunhos detectados aparecem aqui para revisao.
              </p>
            </Card>
          ) : (
            <Card>
              {drafts.map((draftItem, i) => {
                const status = getCollegeQuickCaptureDraftStatus(draftItem);

                return (
                  <article
                    key={draftItem.id}
                    className="grid gap-4 py-4"
                    style={{
                      borderBottom: i === drafts.length - 1 ? 'none' : '1px solid var(--hub-border)',
                      borderLeft: status === 'incomplete' ? '2px solid var(--hub-warning)' : 'none',
                      paddingLeft: status === 'incomplete' ? '12px' : '0',
                      opacity: status === 'ignored' ? 0.55 : 1,
                    }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: draftItem.type === 'assessment' ? 'var(--hub-accent)' : 'var(--hub-positive)' }}>
                          {draftItem.type === 'assessment' ? 'Avaliacao' : 'Tarefa'}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: statusColor[status] }}>
                          {statusLabel[status]}
                        </span>
                      </div>
                      <InlineButton label={draftItem.ignored ? 'Restaurar' : 'Ignorar'} onClick={() => updateDraft(draftItem.id, { ignored: !draftItem.ignored })} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ShortcutButton label="Tarefa" active={draftItem.type === 'task'} onClick={() => updateDraft(draftItem.id, { type: 'task', assessmentType: undefined, weight: undefined })} />
                      <ShortcutButton label="Avaliacao" active={draftItem.type === 'assessment'} onClick={() => updateDraft(draftItem.id, { type: 'assessment', assessmentType: draftItem.assessmentType ?? 'other' })} />
                      {!draftItem.date ? (
                        <>
                          <ShortcutButton label="Hoje" onClick={() => updateDraft(draftItem.id, { date: todayKey() })} />
                          <ShortcutButton label="Amanha" onClick={() => updateDraft(draftItem.id, { date: addDays(todayKey(), 1) })} />
                        </>
                      ) : null}
                      {!draftItem.subjectId && firstSubject ? (
                        <ShortcutButton label={`Usar ${firstSubject.shortName ?? firstSubject.name}`} onClick={() => updateDraft(draftItem.id, { subjectId: firstSubject.id })} />
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Tipo">
                        <Select className={selectClass} value={draftItem.type} onChange={(value) => updateDraft(draftItem.id, { type: value as CollegeQuickCaptureDraft['type'] })}>
                          <Select.Option value="task">Tarefa</Select.Option>
                          <Select.Option value="assessment">Avaliacao</Select.Option>
                        </Select>
                      </Field>
                      <Field label="Disciplina">
                        <Select className={selectClass} value={draftItem.subjectId} onChange={(value) => updateDraft(draftItem.id, { subjectId: value })}>
                          <Select.Option value="">Escolha</Select.Option>
                          {subjects.map((subject) => <Select.Option key={subject.id} value={subject.id}>{subject.name}</Select.Option>)}
                        </Select>
                      </Field>
                      <Field label="Titulo">
                        <input className={inputClass} value={draftItem.title} onChange={(event) => updateDraft(draftItem.id, { title: event.target.value })} />
                      </Field>
                      <Field label="Data">
                        <input className={inputClass} type="date" value={draftItem.date} onChange={(event) => updateDraft(draftItem.id, { date: event.target.value })} />
                      </Field>
                      {draftItem.type === 'assessment' ? (
                        <>
                          <Field label="Tipo de avaliacao">
                            <Select className={selectClass} value={draftItem.assessmentType ?? 'other'} onChange={(value) => updateDraft(draftItem.id, { assessmentType: value as Assessment['type'] })}>
                              <Select.Option value="exam">Prova</Select.Option>
                              <Select.Option value="quiz">Quiz</Select.Option>
                              <Select.Option value="presentation">Apresentacao</Select.Option>
                              <Select.Option value="practical">Pratica</Select.Option>
                              <Select.Option value="other">Outro</Select.Option>
                            </Select>
                          </Field>
                          <Field label="Peso">
                            <input className={inputClass} inputMode="decimal" value={draftItem.weight ?? ''} onChange={(event) => updateDraft(draftItem.id, { weight: event.target.value ? Number(event.target.value.replace(',', '.')) : undefined })} />
                          </Field>
                        </>
                      ) : null}
                    </div>

                    <Field label="Observacoes">
                      <textarea className={`${inputClass} min-h-20 pt-1`} value={draftItem.notes} onChange={(event) => updateDraft(draftItem.id, { notes: event.target.value })} />
                    </Field>

                    {draftItem.warnings.length > 0 ? (
                      <ul className="grid gap-1 text-xs" style={{ color: 'var(--hub-warning)', borderLeft: '2px solid var(--hub-warning)', paddingLeft: '10px' }}>
                        {draftItem.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    ) : null}
                    <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>Origem: {draftItem.sourceLine}</p>
                  </article>
                );
              })}
            </Card>
          )}
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

function ShortcutButton({ active = false, label, onClick }: { active?: boolean; label: string; onClick(): void }) {
  return (
    <button
      className="px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
      style={{
        color: active ? 'var(--hub-accent)' : 'var(--hub-subtle)',
        background: 'none',
        border: 'none',
        borderBottom: `1px solid ${active ? 'var(--hub-accent)' : 'transparent'}`,
        cursor: 'pointer',
      }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ActionLink({ label, to }: { label: string; to: string }) {
  return (
    <Link
      className="text-xs font-semibold transition-opacity hover:opacity-70"
      style={{ color: 'var(--hub-positive)' }}
      to={to}
    >
      {label}
    </Link>
  );
}

function SummaryChip({ color, label, value, last = false }: { color: string; label: string; value: number; last?: boolean }) {
  return (
    <div className="py-2" style={{ borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>{label}</p>
      <p className="mt-1 text-lg font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}
