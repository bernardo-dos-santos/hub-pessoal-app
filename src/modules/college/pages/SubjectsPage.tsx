import { type FormEvent, type ReactNode, useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../shared/ui';
import { COLLEGE_TABS } from '../components/collegeTabs';
import { EmptyCollegeState } from '../components/EmptyCollegeState';
import { SubjectCard } from '../components/SubjectCard';
import { defaultSubjectColors } from '../data/defaultCollegeData';
import { isEmptyRemoval, subjectService } from '../services/subjectService';
import { type Subject } from '../types/subject';
import { getCurrentSemester } from '../utils/collegePeriod';

const colorLabels: Record<string, string> = {
  '#0284c7': 'Azul',
  '#16a34a': 'Verde',
  '#ca8a04': 'Amarelo',
  '#dc2626': 'Vermelho',
  '#7c3aed': 'Roxo',
  '#0891b2': 'Ciano',
};

type SubjectDraft = {
  aliases: string;
  color: string;
  location: string;
  name: string;
  notes: string;
  professor: string;
  semester: string;
  shortName: string;
  status: Subject['status'];
};

function createDraft(subject?: Subject): SubjectDraft {
  return {
    aliases: subject?.aliases?.join(', ') ?? '',
    color: subject?.color ?? defaultSubjectColors[0],
    location: subject?.location ?? '',
    name: subject?.name ?? '',
    notes: subject?.notes ?? '',
    professor: subject?.professor ?? '',
    semester: subject?.semester ?? getCurrentSemester(),
    shortName: subject?.shortName ?? '',
    status: subject?.status ?? 'active',
  };
}

export function SubjectsPage() {
  const [subjects, setSubjects] = useState(() => subjectService.listSubjects());
  const [draft, setDraft] = useState(() => createDraft());
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function refreshSubjects() {
    setSubjects(subjectService.listSubjects());
  }

  function resetDraft() {
    setEditingSubjectId(null);
    setDraft(createDraft());
  }

  function saveSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    try {
      const input = {
        color: draft.color,
        aliases: draft.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
        location: draft.location.trim() || undefined,
        name: draft.name,
        notes: draft.notes.trim() || undefined,
        professor: draft.professor.trim() || undefined,
        semester: draft.semester,
        shortName: draft.shortName.trim() || undefined,
        status: draft.status,
      };

      if (editingSubjectId) {
        subjectService.updateSubject(editingSubjectId, input);
        setMessage('Disciplina atualizada.');
      } else {
        subjectService.createSubject(input);
        setMessage('Disciplina criada.');
      }

      refreshSubjects();
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel salvar a disciplina.');
    }
  }

  function startEditing(subject: Subject) {
    setEditingSubjectId(subject.id);
    setDraft(createDraft(subject));
    setMessage('');
    setError('');
  }

  function deleteSubject(subject: Subject) {
    // A exclusão leva junto tudo que pertence à disciplina e não tem desfazer —
    // por isso a confirmação lista item a item o que vai sumir.
    const preview = subjectService.previewRemoval(subject.id);
    const items = [
      preview.tasks && `${preview.tasks} tarefa(s)`,
      preview.assessments && `${preview.assessments} avaliação(ões)`,
      preview.grades && `${preview.grades} nota(s)`,
      preview.materials && `${preview.materials} material(is)`,
      preview.alerts && `${preview.alerts} aviso(s)`,
      preview.studyContents && `${preview.studyContents} conteúdo(s) de estudo`,
      preview.questions && `${preview.questions} questão(ões)`,
      preview.errorNotebookEntries && `${preview.errorNotebookEntries} entrada(s) do caderno de erros`,
      preview.decks && `${preview.decks} deck(s) de flashcard (${preview.flashcards} carta(s))`,
    ].filter(Boolean);

    const detail = isEmptyRemoval(preview)
      ? 'Ela não tem nada vinculado.'
      : `Isto também apaga, de forma permanente:\n\n• ${items.join('\n• ')}`;

    if (!confirm(`Excluir "${subject.name}"?\n\n${detail}`)) return;

    const removed = subjectService.removeSubject(subject.id);
    refreshSubjects();
    const total = removed.tasks + removed.assessments + removed.grades + removed.materials + removed.alerts
      + removed.studyContents + removed.questions + removed.errorNotebookEntries + removed.decks;
    setMessage(total > 0
      ? `Disciplina excluída, junto com ${total} item(ns) vinculado(s).`
      : 'Disciplina excluída.');
    if (editingSubjectId === subject.id) resetDraft();
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Faculdade" title="Disciplinas" tabs={COLLEGE_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Materias do semestre, professores, locais e anotacoes rapidas.
      </p>

      {message ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-positive)' }}>{message}</p> : null}
      {error ? <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <form className="grid gap-5" onSubmit={saveSubject}>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>
                {editingSubjectId ? 'Editar disciplina' : 'Criar disciplina'}
              </h3>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                Comece pelo nome; apelidos ajudam a captura rapida a reconhecer suas anotacoes.
              </p>
            </div>

            <Field label="Nome">
              <input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Algoritmos" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Apelido">
                <input className={inputClass} value={draft.shortName} onChange={(event) => setDraft({ ...draft, shortName: event.target.value })} placeholder="ALG" />
              </Field>
              <Field label="Semestre">
                <input className={inputClass} value={draft.semester} onChange={(event) => setDraft({ ...draft, semester: event.target.value })} placeholder="2026.1" />
              </Field>
              <Field label="Professor">
                <input className={inputClass} value={draft.professor} onChange={(event) => setDraft({ ...draft, professor: event.target.value })} placeholder="Opcional" />
              </Field>
              <Field label="Local">
                <input className={inputClass} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Sala ou bloco" />
              </Field>
            </div>
            <Field label="Aliases da captura rapida">
              <input
                className={inputClass}
                value={draft.aliases}
                onChange={(event) => setDraft({ ...draft, aliases: event.target.value })}
                placeholder="POO, Prog Orientada, Orientacao a Objetos"
              />
              <span className="block text-xs leading-5 mt-1" style={{ color: 'var(--hub-subtle)' }}>
                Separe por virgula. Ex.: BD, Banco, Calc, ES, Eng Software.
              </span>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Cor">
                <div className="flex items-center gap-3 py-1">
                  {defaultSubjectColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={colorLabels[color] ?? color}
                      className={`h-6 w-6 rounded-full transition-transform ${draft.color === color ? 'scale-125 ring-2 ring-offset-1' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color, ...(draft.color === color ? { boxShadow: '0 0 0 2px var(--hub-card), 0 0 0 4px var(--hub-border-strong)' } : {}) }}
                      onClick={() => setDraft({ ...draft, color })}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Status">
                <Select className={selectClass} value={draft.status} onChange={(value) => setDraft({ ...draft, status: value as Subject['status'] })}>
                  <Select.Option value="active">Ativa</Select.Option>
                  <Select.Option value="completed">Concluida</Select.Option>
                  <Select.Option value="archived">Arquivada</Select.Option>
                </Select>
              </Field>
            </div>
            <Field label="Notas">
              <textarea className={`${inputClass} min-h-24 pt-1`} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Observacoes livres" />
            </Field>
            <div className="flex items-center gap-5">
              <button
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                type="submit"
              >
                {editingSubjectId ? 'Salvar disciplina' : 'Criar disciplina'}
              </button>
              {editingSubjectId ? <InlineButton label="Cancelar" onClick={resetDraft} /> : null}
            </div>
          </form>
        </Card>

        <Card>
          {subjects.length === 0 ? (
            <EmptyCollegeState title="Nenhuma disciplina cadastrada." description="Crie as materias do semestre para ligar tarefas, avaliacoes, notas e materiais." />
          ) : (
            subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                actions={(
                  <>
                    <InlineButton label="Editar" onClick={() => startEditing(subject)} />
                    {subject.status !== 'archived' ? (
                      <InlineButton label="Arquivar" onClick={() => {
                        subjectService.archiveSubject(subject.id);
                        refreshSubjects();
                        setMessage('Disciplina arquivada.');
                      }} />
                    ) : null}
                    <InlineButton label="Excluir" danger onClick={() => deleteSubject(subject)} />
                  </>
                )}
              />
            ))
          )}
        </Card>
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

function InlineButton({ label, onClick, danger }: { label: string; onClick(): void; danger?: boolean }) {
  return (
    <button
      className="text-xs transition-opacity hover:opacity-70"
      style={{ color: danger ? 'var(--hub-negative)' : 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
