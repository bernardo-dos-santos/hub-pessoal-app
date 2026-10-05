import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, EditableText, Eyebrow, ModuleHeader, Select } from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { frontService } from '../services/frontService';
import { projectIssueService } from '../services/projectIssueService';
import { projectService } from '../services/projectService';
import {
  ISSUE_KIND_LABEL, ISSUE_SEVERITY_LABEL, isIssueOpen,
  type IssueKind, type IssueSeverity, type ProjectIssue,
} from '../types/projectIssue';

type Filter = 'all' | IssueKind;

const KIND_COLOR: Record<IssueKind, string> = {
  bug: 'var(--hub-negative)',
  improvement: 'var(--hub-accent)',
  idea: 'var(--hub-warning)',
};

export function ProjectIssuesPage() {
  const { projectId = '' } = useParams();
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  const [filter, setFilter] = useState<Filter>('all');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<IssueKind>('bug');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [frontId, setFrontId] = useState('');
  const [error, setError] = useState('');

  const project = projectService.getById(projectId);
  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Melhorias" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  const fronts = frontService.listByProject(project.id);
  const all = projectIssueService.listByProject(project.id);
  const shown = filter === 'all' ? all : all.filter((i) => i.kind === filter);
  const counts = {
    all: all.length,
    bug: all.filter((i) => i.kind === 'bug').length,
    improvement: all.filter((i) => i.kind === 'improvement').length,
    idea: all.filter((i) => i.kind === 'idea').length,
  };

  function add() {
    try {
      projectIssueService.create({
        projectId: project!.id, title, kind, severity,
        frontId: frontId || undefined,
      });
      setTitle('');
      setError('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível anotar.');
    }
  }

  function rename(issue: ProjectIssue, value: string) {
    projectIssueService.setTitle(issue.id, value);
    refresh();
  }

  function promote(issue: ProjectIssue) {
    if (!confirm(`Transformar em tarefa?\n\n"${issue.title}"\n\nA partir daí ela passa a contar no progresso do projeto.`)) return;
    projectIssueService.promoteToTask(issue.id);
    refresh();
  }

  function resolve(issue: ProjectIssue) {
    projectIssueService.setStatus(issue.id, issue.status === 'done' ? 'open' : 'done');
    refresh();
  }

  function discard(issue: ProjectIssue) {
    if (!confirm(`Descartar "${issue.title}"?`)) return;
    projectIssueService.remove(issue.id);
    refresh();
  }

  const filters: Array<{ key: Filter; label: string; n: number }> = [
    { key: 'all', label: 'Todos', n: counts.all },
    { key: 'bug', label: 'Bugs', n: counts.bug },
    { key: 'improvement', label: 'Melhorias', n: counts.improvement },
    { key: 'idea', label: 'Ideias', n: counts.idea },
  ];

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Melhorias"
        tabs={getProjectTabs(project)}
        back
      />

      <Card>
        <Eyebrow style={{ marginBottom: '8px' }}>Anotar</Eyebrow>
        <input
          className="w-full"
          placeholder="Ex.: briefing mostra data errada"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label>
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Tipo</span>
            <Select className="w-full" value={kind} onChange={(value) => setKind(value as IssueKind)}>
              <Select.Option value="bug">Bug</Select.Option>
              <Select.Option value="improvement">Melhoria</Select.Option>
              <Select.Option value="idea">Ideia</Select.Option>
            </Select>
          </label>
          <label>
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Severidade</span>
            <Select className="w-full" value={severity} onChange={(value) => setSeverity(value as IssueSeverity)}>
              <Select.Option value="high">Alta</Select.Option>
              <Select.Option value="medium">Média</Select.Option>
              <Select.Option value="low">Baixa</Select.Option>
            </Select>
          </label>
          <label>
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Frente</span>
            <Select className="w-full" value={frontId} onChange={setFrontId}>
              <Select.Option value="">Sem frente</Select.Option>
              {fronts.map((f) => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
            </Select>
          </label>
        </div>
        {error && <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
        <div className="mt-4">
          <button onClick={add} className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Anotar
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap gap-4">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: filter === f.key ? 'var(--hub-text)' : 'var(--hub-subtle)',
                fontWeight: filter === f.key ? 600 : 400,
              }}
            >
              {f.label} <span className="tabular-nums">{f.n}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--hub-disabled)' }}>
            Nada anotado aqui. Este inbox pode encher à vontade — issue não conta no progresso do projeto.
          </p>
        ) : (
          shown.map((issue, i) => {
            const closed = !isIssueOpen(issue);
            const front = issue.frontId ? fronts.find((f) => f.id === issue.frontId) : null;
            return (
              <div
                key={issue.id}
                className="flex items-baseline gap-3 py-2.5"
                style={{ borderBottom: i === shown.length - 1 ? 'none' : '1px solid var(--hub-border)', opacity: closed ? 0.55 : 1 }}
              >
                <span className="shrink-0 text-xs font-medium" style={{ color: KIND_COLOR[issue.kind] }}>
                  {ISSUE_KIND_LABEL[issue.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <EditableText
                    className="max-w-full"
                    inputClassName="w-full text-sm"
                    value={issue.title}
                    onSave={(value) => rename(issue, value)}
                    ariaLabel={`Renomear ${ISSUE_KIND_LABEL[issue.kind].toLowerCase()} ${issue.title}`}
                  >
                    <span className="text-sm" style={{ color: 'var(--hub-text-body)', textDecoration: issue.status === 'done' ? 'line-through' : 'none' }}>
                      {issue.title}
                    </span>
                  </EditableText>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-muted)' }}>
                    {front?.name ?? 'sem frente'} · {ISSUE_SEVERITY_LABEL[issue.severity ?? 'medium']}
                    {issue.promotedTaskId && ' · virou tarefa'}
                  </p>
                </div>
                <div className="flex shrink-0 items-baseline gap-3">
                  {!issue.promotedTaskId && issue.status !== 'done' && (
                    <button onClick={() => promote(issue)} className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      virar tarefa
                    </button>
                  )}
                  <button onClick={() => resolve(issue)} className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {issue.status === 'done' ? 'reabrir' : 'resolver'}
                  </button>
                  <button onClick={() => discard(issue)} className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    descartar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
