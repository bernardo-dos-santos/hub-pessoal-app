import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, DateField, EditableText, Eyebrow, ModuleHeader, ProgressBar } from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { frontService } from '../services/frontService';
import { daysSince, projectService } from '../services/projectService';
import { projectTaskService } from '../services/projectTaskService';
import { FRONT_PHASE_LABEL, type Front, type FrontPhase } from '../types/front';
import { isCodeProject } from '../types/project';
import {
  DUE_MOVE_ALERT_THRESHOLD, isTaskDueSoon, isTaskOverdue, TASK_PRIORITY_LABEL,
  type ProjectTask, type ProjectTaskPriority,
} from '../types/projectTask';
import { isMilestoneOverdue, type ProjectMilestone } from '../types/projectMilestone';
import { projectMilestoneService, todayDate } from '../services/projectMilestoneService';

function statusMark(status: ProjectTask['status']): string {
  if (status === 'done') return '✓';
  if (status === 'canceled') return '×';
  if (status === 'doing') return '▸';
  return '○';
}

/** dd/mm — ano só aparece quando não é o corrente, para a linha não inchar. */
function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  const currentYear = String(new Date().getFullYear());
  return year === currentYear ? `${day}/${month}` : `${day}/${month}/${year.slice(2)}`;
}

function dueColor(task: ProjectTask, today: string): string {
  if (isTaskOverdue(task, today)) return 'var(--hub-negative)';
  if (isTaskDueSoon(task, today)) return 'var(--hub-warning)';
  return 'var(--hub-muted)';
}

const PRIORITY_CYCLE: (ProjectTaskPriority | undefined)[] = [undefined, 'high', 'medium', 'low'];

const PRIORITY_COLOR: Record<ProjectTaskPriority, string> = {
  high: 'var(--hub-negative)',
  medium: 'var(--hub-warning)',
  low: 'var(--hub-muted)',
};

function TaskRow({
  task, depth, isNextAction, today, onToggle, onRemove, onAddSub, onSetNextAction, onSetDueDate, onCyclePriority, onRename,
}: {
  task: ProjectTask;
  depth: number;
  isNextAction: boolean;
  today: string;
  onToggle: (t: ProjectTask) => void;
  onRemove: (t: ProjectTask) => void;
  onAddSub: (t: ProjectTask) => void;
  onSetNextAction: (t: ProjectTask) => void;
  onSetDueDate: (t: ProjectTask, value: string) => void;
  onCyclePriority: (t: ProjectTask) => void;
  onRename: (t: ProjectTask, value: string) => void;
}) {
  const closed = task.status === 'done' || task.status === 'canceled';
  const postponed = (task.dueMoveCount ?? 0) >= DUE_MOVE_ALERT_THRESHOLD;
  return (
    <div
      className="flex items-baseline gap-3 py-2"
      style={{ paddingLeft: `${depth * 20}px`, borderBottom: '1px solid var(--hub-border)' }}
    >
      <button
        onClick={() => onToggle(task)}
        aria-label={closed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        className="shrink-0 transition-opacity hover:opacity-70"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: closed ? 'var(--hub-positive)' : 'var(--hub-subtle)', fontSize: '13px' }}
      >
        {statusMark(task.status)}
      </button>

      <EditableText
        className="min-w-0 flex-1"
        inputClassName="min-w-0 flex-1 text-sm"
        value={task.title}
        onSave={(value) => onRename(task, value)}
        ariaLabel={`Renomear tarefa ${task.title}`}
      >
        <span
          className="min-w-0 truncate text-sm"
          style={{ color: closed ? 'var(--hub-disabled)' : 'var(--hub-text-body)', textDecoration: closed ? 'line-through' : 'none' }}
        >
          {task.title}
        </span>
      </EditableText>

      {/* Adiada demais: o contador devolve o atrito que o papel tinha. Três
          adiamentos costumam significar que a tarefa nunca importou. */}
      {postponed && !closed && (
        <span
          className="shrink-0 text-xs tabular-nums"
          style={{ color: 'var(--hub-warning)' }}
          title={`Prazo empurrado ${task.dueMoveCount} vezes`}
        >
          adiada {task.dueMoveCount}×
        </span>
      )}

      {!closed && (
        <DateField
          className="shrink-0"
          value={task.dueDate ?? ''}
          onChange={(value) => onSetDueDate(task, value)}
          ariaLabel={`Prazo de ${task.title}`}
        >
          <span
            className="text-xs tabular-nums transition-opacity hover:opacity-70"
            style={{ color: task.dueDate ? dueColor(task, today) : 'var(--hub-subtle)' }}
          >
            {task.dueDate ? shortDate(task.dueDate) : '+ prazo'}
          </span>
        </DateField>
      )}

      {!closed && (
        <button
          onClick={() => onCyclePriority(task)}
          aria-label={`Prioridade de ${task.title}${task.priority ? `: ${TASK_PRIORITY_LABEL[task.priority]}` : ''}`}
          className="shrink-0 text-xs transition-opacity hover:opacity-70"
          style={{
            color: task.priority ? PRIORITY_COLOR[task.priority] : 'var(--hub-disabled)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {task.priority ? TASK_PRIORITY_LABEL[task.priority].toLowerCase() : '·'}
        </button>
      )}

      {/* Só tarefa aberta pode virar próximo passo — apontar uma concluída
          seria a mesma mentira que `clearNextActionFor` existe para evitar. */}
      {!closed && (
        <button
          onClick={() => onSetNextAction(task)}
          aria-label={isNextAction ? 'Desmarcar como próxima ação' : 'Marcar como próxima ação'}
          className="shrink-0 text-xs transition-opacity hover:opacity-70"
          style={{
            color: isNextAction ? 'var(--hub-accent)' : 'var(--hub-subtle)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {isNextAction ? 'é o próximo' : 'próximo'}
        </button>
      )}
      {depth === 0 && (
        <button
          onClick={() => onAddSub(task)}
          className="shrink-0 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          + sub
        </button>
      )}
      <button
        onClick={() => onRemove(task)}
        className="shrink-0 text-xs transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        excluir
      </button>
    </div>
  );
}

/**
 * A próxima ação, fixada no topo do card.
 *
 * É o tratamento que faltava: a tela sabia diagnosticar ("parado há 15 dias")
 * e não sabia dizer por onde recomeçar. Quando não há nenhuma definida, a
 * ausência é dita em voz alta — é ela, e não o tempo parado, que costuma ser
 * a causa real da frente não andar.
 */
function NextActionLine({ task }: { task: ProjectTask | null }) {
  return (
    <div className="pb-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
      <Eyebrow>Próxima ação</Eyebrow>
      <p
        className="mt-1 text-sm"
        style={{ color: task ? 'var(--hub-accent)' : 'var(--hub-disabled)' }}
      >
        {task ? task.title : 'Nenhuma definida — marque uma tarefa como "próximo".'}
      </p>
    </div>
  );
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [, forceRender] = useState(0);
  const refresh = () => forceRender((n) => n + 1);

  const project = projectService.getById(projectId);
  const [newTask, setNewTask] = useState<Record<string, string>>({});
  const [frontName, setFrontName] = useState('');
  const [frontGitScope, setFrontGitScope] = useState('');
  const [addingFront, setAddingFront] = useState(false);
  const [editingScopeFrontId, setEditingScopeFrontId] = useState<string | null>(null);
  const [scopeDraft, setScopeDraft] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');

  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Projeto" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  const isCode = isCodeProject(project);
  const fronts = frontService.listByProject(project.id);
  const loose = projectTaskService.listLoose(project.id);
  const progress = projectService.getProgress(project.id);
  const idle = daysSince(project.lastActivityAt);
  const today = todayDate();
  const milestones = projectMilestoneService.listByProject(project.id);
  const milestoneProgress = projectMilestoneService.getProgress(project.id);

  function addTask(frontId?: string) {
    const key = frontId ?? '__loose__';
    const title = (newTask[key] ?? '').trim();
    if (!title) return;
    projectTaskService.create({ projectId: project!.id, title, frontId });
    setNewTask((s) => ({ ...s, [key]: '' }));
    refresh();
  }

  function addSubtask(parent: ProjectTask) {
    const title = prompt(`Subtarefa de "${parent.title}":`);
    if (!title?.trim()) return;
    projectTaskService.create({
      projectId: project!.id, title, frontId: parent.frontId, parentTaskId: parent.id,
    });
    refresh();
  }

  function toggleTask(task: ProjectTask) {
    projectTaskService.setStatus(task.id, task.status === 'done' ? 'todo' : 'done');
    refresh();
  }

  function removeTask(task: ProjectTask) {
    const subs = projectTaskService.listSubtasks(task.id).length;
    const extra = subs > 0 ? `\n\nAs ${subs} subtarefa(s) também serão apagadas.` : '';
    if (!confirm(`Excluir "${task.title}"?${extra}`)) return;
    projectTaskService.remove(task.id);
    refresh();
  }

  function createFront() {
    if (!frontName.trim()) return;
    const front = frontService.create(project!.id, frontName);
    const scope = frontGitScope.trim().toLowerCase();
    if (scope) frontService.update(front.id, { gitScope: scope });
    setFrontName('');
    setFrontGitScope('');
    setAddingFront(false);
    refresh();
  }

  function startEditScope(front: Front) {
    setEditingScopeFrontId(front.id);
    setScopeDraft(front.gitScope ?? '');
  }

  function saveScope(front: Front) {
    frontService.update(front.id, { gitScope: scopeDraft.trim().toLowerCase() || undefined });
    setEditingScopeFrontId(null);
    refresh();
  }

  function setDueDate(task: ProjectTask, value: string) {
    projectTaskService.setDueDate(task.id, value || undefined);
    refresh();
  }

  function cyclePriority(task: ProjectTask) {
    const current = PRIORITY_CYCLE.indexOf(task.priority);
    projectTaskService.setPriority(task.id, PRIORITY_CYCLE[(current + 1) % PRIORITY_CYCLE.length]);
    refresh();
  }

  function renameTask(task: ProjectTask, value: string) {
    projectTaskService.setTitle(task.id, value);
    refresh();
  }

  function renameMilestone(milestone: ProjectMilestone, value: string) {
    projectMilestoneService.update(milestone.id, { title: value });
    refresh();
  }

  function renameFront(front: Front, value: string) {
    frontService.update(front.id, { name: value });
    refresh();
  }

  function addMilestone() {
    const title = milestoneTitle.trim();
    if (!title) return;
    projectMilestoneService.create({ projectId: project!.id, title, targetDate: milestoneDate || undefined });
    setMilestoneTitle('');
    setMilestoneDate('');
    refresh();
  }

  function toggleMilestone(milestone: ProjectMilestone) {
    projectMilestoneService.toggleReached(milestone.id);
    refresh();
  }

  function setMilestoneTargetDate(milestone: ProjectMilestone, value: string) {
    projectMilestoneService.update(milestone.id, { targetDate: value });
    refresh();
  }

  function removeMilestone(milestone: ProjectMilestone) {
    if (!confirm(`Remover o marco "${milestone.title}"?`)) return;
    projectMilestoneService.remove(milestone.id);
    refresh();
  }

  /** Clicar de novo na mesma tarefa desmarca — é o jeito de "não sei ainda". */
  function setNextAction(task: ProjectTask, currentId?: string) {
    const nextActionTaskId = currentId === task.id ? undefined : task.id;
    if (task.frontId) frontService.update(task.frontId, { nextActionTaskId });
    else projectService.update(project!.id, { nextActionTaskId });
    refresh();
  }

  function togglePhase(front: Front, phase: FrontPhase) {
    frontService.update(front.id, { phase: front.phase === phase ? undefined : phase });
    refresh();
  }

  function removeFront(front: Front) {
    const { orphanedTasks } = frontService.previewRemoval(front.id);
    const extra = orphanedTasks > 0
      ? `\n\n${orphanedTasks} tarefa(s) voltam para o projeto, sem frente — não são apagadas.`
      : '';
    if (!confirm(`Remover a frente "${front.name}"?${extra}`)) return;
    frontService.remove(front.id);
    refresh();
  }

  function removeProject() {
    const { fronts: f, tasks: t, issues: i, decisions: d, expansions: e, milestones: m } = projectService.previewRemoval(project!.id);
    const items = [
      f && `${f} frente(s)`, t && `${t} tarefa(s)`,
      i && `${i} melhoria(s)`, d && `${d} decisão(ões) registrada(s)`,
      e && `${e} ideia(s) de expansão`, m && `${m} marco(s)`,
    ].filter(Boolean);
    const detail = items.length > 0
      ? `Isto também apaga, de forma permanente:\n\n• ${items.join('\n• ')}`
      : 'Ele não tem nada vinculado.';
    if (!confirm(`Excluir o projeto "${project!.name}"?\n\n${detail}`)) return;
    projectService.remove(project!.id);
    navigate('/projetos');
  }

  function renderTasks(tasks: ProjectTask[], nextActionTaskId?: string) {
    const row = (task: ProjectTask, depth: number) => (
      <TaskRow
        key={task.id}
        task={task}
        depth={depth}
        today={today}
        isNextAction={task.id === nextActionTaskId}
        onToggle={toggleTask}
        onRemove={removeTask}
        onAddSub={addSubtask}
        onSetNextAction={(t) => setNextAction(t, nextActionTaskId)}
        onSetDueDate={setDueDate}
        onCyclePriority={cyclePriority}
        onRename={renameTask}
      />
    );
    return tasks.map((task) => (
      <div key={task.id}>
        {row(task, 0)}
        {projectTaskService.listSubtasks(task.id).map((sub) => row(sub, 1))}
      </div>
    ));
  }

  function taskInput(frontId: string | undefined, placeholder: string) {
    const key = frontId ?? '__loose__';
    return (
      <input
        className="w-full text-sm"
        placeholder={placeholder}
        value={newTask[key] ?? ''}
        onChange={(e) => setNewTask((s) => ({ ...s, [key]: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') addTask(frontId); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* `back` explícito em toda tela do projeto: o cabeçalho esconde a seta
          sozinho quando a rota é uma das abas, e como AGORA todas são, o
          projeto viraria uma caixa sem saída para a lista. */}
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Visão geral"
        tabs={getProjectTabs(project)}
        back
      />

      <Card>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <Eyebrow>Progresso</Eyebrow>
            <p className="tabular-nums" style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
              {progress.percent}%
            </p>
          </div>
          <p className="text-xs" style={{ color: projectService.isStalled(project) ? 'var(--hub-warning)' : 'var(--hub-muted)' }}>
            {idle === 0 ? 'ativo hoje' : `última atividade há ${idle} dia${idle === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="mt-3"><ProgressBar value={progress.percent} percent /></div>
        <p className="mt-2 text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
          {progress.done} de {progress.total} tarefas
          {milestoneProgress.total > 0 && (
            <> · {milestoneProgress.reached} de {milestoneProgress.total} marcos</>
          )}
        </p>
      </Card>

      {/* Marcos: progresso que não depende de quantas tarefas existem. Viagem
          não está 40% pronta porque 4 de 10 itens do checklist foram marcados,
          e campanha de RPG nem tem as sessões futuras cadastradas. */}
      <Card>
        <Eyebrow style={{ marginBottom: '8px' }}>Marcos</Eyebrow>
        {milestones.map((milestone, i) => {
          const reached = Boolean(milestone.reachedAt);
          const overdue = isMilestoneOverdue(milestone, today);
          return (
            <div
              key={milestone.id}
              className="flex items-baseline gap-3 py-2"
              style={{ borderBottom: i === milestones.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <button
                onClick={() => toggleMilestone(milestone)}
                aria-label={reached ? 'Marcar como pendente' : 'Marcar como atingido'}
                className="shrink-0 transition-opacity hover:opacity-70"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: reached ? 'var(--hub-positive)' : 'var(--hub-subtle)' }}
              >
                {reached ? '✓' : '○'}
              </button>
              <EditableText
                className="min-w-0 flex-1"
                inputClassName="min-w-0 flex-1 text-sm"
                value={milestone.title}
                onSave={(value) => renameMilestone(milestone, value)}
                ariaLabel={`Renomear marco ${milestone.title}`}
              >
                <span
                  className="min-w-0 truncate text-sm"
                  style={{ color: reached ? 'var(--hub-disabled)' : 'var(--hub-text-body)' }}
                >
                  {milestone.title}
                </span>
              </EditableText>
              {/* Data editável: adiar marco é o sinal mais honesto de plano
                  furando, e sem poder mexer aqui o adiamento nunca é gravado. */}
              <DateField
                className="shrink-0"
                value={milestone.targetDate ?? ''}
                onChange={(value) => setMilestoneTargetDate(milestone, value)}
                ariaLabel={`Data do marco ${milestone.title}`}
              >
                <span
                  className="text-xs tabular-nums transition-opacity hover:opacity-70"
                  style={{ color: milestone.targetDate ? (overdue ? 'var(--hub-negative)' : 'var(--hub-muted)') : 'var(--hub-subtle)' }}
                >
                  {milestone.targetDate ? shortDate(milestone.targetDate) : '+ data'}
                </span>
              </DateField>
              <button
                onClick={() => removeMilestone(milestone)}
                className="shrink-0 text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                remover
              </button>
            </div>
          );
        })}
        {milestones.length === 0 && (
          <p className="pb-2 text-xs" style={{ color: 'var(--hub-disabled)' }}>
            Nenhum marco ainda. Um marco é um ponto verificável — "Arco 1 encerrado", "mudança feita".
          </p>
        )}
        <div className="flex items-baseline gap-3 pt-3">
          <input
            className="min-w-0 flex-1 text-sm"
            placeholder="Novo marco…"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMilestone(); }}
          />
          <DateField
            className="shrink-0"
            value={milestoneDate}
            onChange={setMilestoneDate}
            ariaLabel="Data do novo marco"
          >
            <span
              className="text-xs tabular-nums transition-opacity hover:opacity-70"
              style={{ color: milestoneDate ? 'var(--hub-text-body)' : 'var(--hub-subtle)' }}
            >
              {milestoneDate ? shortDate(milestoneDate) : '+ data'}
            </span>
          </DateField>
        </div>
      </Card>

      {/* Tarefas sem frente — projeto simples vive só disto */}
      <Card>
        <Eyebrow style={{ marginBottom: '8px' }}>Tarefas</Eyebrow>
        {loose.length > 0 && (
          <div className="mb-1">
            <NextActionLine task={projectTaskService.getNextAction(project.nextActionTaskId)} />
          </div>
        )}
        {loose.length > 0 ? renderTasks(loose, project.nextActionTaskId) : (
          <p className="pb-2 text-xs" style={{ color: 'var(--hub-disabled)' }}>Nenhuma tarefa solta.</p>
        )}
        <div className="pt-3">{taskInput(undefined, 'Nova tarefa…')}</div>
      </Card>

      {/* Frentes paralelas */}
      {fronts.map((front) => {
        const tasks = projectTaskService.listRoot(project.id, front.id);
        const frontIdle = daysSince(front.lastActivityAt);
        return (
          <Card key={front.id}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow>Frente</Eyebrow>
                <EditableText
                  className="max-w-full"
                  inputClassName="w-full text-sm font-medium"
                  value={front.name}
                  onSave={(value) => renameFront(front, value)}
                  ariaLabel={`Renomear frente ${front.name}`}
                >
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{front.name}</span>
                </EditableText>
                {isCode && (editingScopeFrontId === front.id ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      className="text-xs"
                      style={{ width: '120px' }}
                      autoFocus
                      value={scopeDraft}
                      placeholder="ex.: projects"
                      onChange={(e) => setScopeDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveScope(front); if (e.key === 'Escape') setEditingScopeFrontId(null); }}
                    />
                    <button onClick={() => saveScope(front)} className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      salvar
                    </button>
                    <button onClick={() => setEditingScopeFrontId(null)} className="text-xs transition-opacity hover:opacity-60"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditScope(front)}
                    className="mt-1 text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {front.gitScope ? `git: ${front.gitScope}` : '+ escopo git'}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-baseline gap-4">
                <span className="text-xs" style={{ color: frontIdle >= 14 ? 'var(--hub-warning)' : 'var(--hub-muted)' }}>
                  {frontIdle === 0 ? 'hoje' : `há ${frontIdle}d`}
                </span>
                <button
                  onClick={() => removeFront(front)}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  remover
                </button>
              </div>
            </div>

            {/* Fase antes da lista: é o que explica um 0% honesto. Frente que
                ainda está descobrindo COMO fazer não está atrasada, está numa
                etapa que a porcentagem não sabe representar. */}
            <div className="mb-3 flex items-baseline gap-4">
              {(Object.keys(FRONT_PHASE_LABEL) as FrontPhase[]).map((p) => (
                <button
                  key={p}
                  onClick={() => togglePhase(front, p)}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{
                    color: front.phase === p ? 'var(--hub-accent)' : 'var(--hub-subtle)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {FRONT_PHASE_LABEL[p]}
                </button>
              ))}
            </div>

            {tasks.length > 0 && (
              <div className="mb-1">
                <NextActionLine task={projectTaskService.getNextAction(front.nextActionTaskId)} />
              </div>
            )}
            {tasks.length > 0 ? renderTasks(tasks, front.nextActionTaskId) : (
              <p className="pb-2 text-xs" style={{ color: 'var(--hub-disabled)' }}>Nenhuma tarefa nesta frente.</p>
            )}
            <div className="pt-3">{taskInput(front.id, `Nova tarefa em ${front.name}…`)}</div>
          </Card>
        );
      })}

      <Card>
        {addingFront ? (
          <>
            <label>
              <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                Nome da frente
              </span>
              <input
                className="w-full"
                autoFocus
                value={frontName}
                placeholder="Ex.: Infraestrutura"
                onChange={(e) => setFrontName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createFront(); }}
              />
            </label>
            {isCode && (
              <label className="mt-3 block">
                <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                  Escopo git (opcional)
                </span>
                <input
                  className="w-full"
                  value={frontGitScope}
                  placeholder="ex.: projects — bate com feat(projects): nos commits"
                  onChange={(e) => setFrontGitScope(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createFront(); }}
                />
              </label>
            )}
            <div className="mt-4 flex items-baseline gap-5">
              <button onClick={createFront} className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Criar frente
              </button>
              <button onClick={() => setAddingFront(false)} className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => setAddingFront(true)} className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            + Abrir frente
          </button>
        )}
      </Card>

      <Card>
        <button onClick={removeProject} className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Excluir projeto
        </button>
      </Card>
    </div>
  );
}
