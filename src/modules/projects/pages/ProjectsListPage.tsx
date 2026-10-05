import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chip, EditableText, ModuleHeader, ProgressBar, Select } from '../../../shared/ui';
import { gitLogService, type GitRepo } from '../services/gitLogService';
import { daysSince, projectService } from '../services/projectService';
import {
  PROJECT_KIND_LABEL, PROJECT_STATUS_LABEL, type Project, type ProjectKind,
} from '../types/project';

function StalledBanner({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null;
  return (
    <Card>
      <p className="text-sm" style={{ color: 'var(--hub-warning)' }}>
        {projects.length === 1
          ? `${projects[0].name} está parado há ${daysSince(projects[0].lastActivityAt)} dias.`
          : `${projects.length} projetos parados há mais de duas semanas.`}
      </p>
    </Card>
  );
}

function ProjectCard({ project, onRename }: { project: Project; onRename: (p: Project, value: string) => void }) {
  const progress = projectService.getProgress(project.id);
  const open = projectService.openTaskCount(project.id);
  const stalled = projectService.isStalled(project);
  const idle = daysSince(project.lastActivityAt);
  const inactive = project.status === 'done' || project.status === 'archived';

  return (
    <Link to={`/projetos/${project.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <Card>
        <div style={{ opacity: inactive ? 0.6 : 1 }}>
          <div className="flex items-baseline justify-between gap-3">
            <EditableText
              className="min-w-0"
              inputClassName="min-w-0 flex-1 text-base font-medium"
              value={project.name}
              onSave={(value) => onRename(project, value)}
              ariaLabel={`Renomear projeto ${project.name}`}
            >
              <span className="truncate text-base font-medium" style={{ color: 'var(--hub-text)' }}>{project.name}</span>
            </EditableText>
            {inactive
              ? <span className="shrink-0 text-xs" style={{ color: 'var(--hub-muted)' }}>{PROJECT_STATUS_LABEL[project.status]}</span>
              : <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>{progress.percent}%</span>}
          </div>

          {!inactive && (
            <div className="mt-3">
              <ProgressBar value={progress.percent} percent />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--hub-muted)' }}>
            {!inactive && <span className="tabular-nums">{open} tarefa{open === 1 ? '' : 's'} aberta{open === 1 ? '' : 's'}</span>}
            {project.status === 'active' && (
              <span style={{ color: stalled ? 'var(--hub-warning)' : 'var(--hub-positive)' }}>
                {idle === 0 ? 'ativo hoje' : idle === 1 ? 'ativo ontem' : `${stalled ? 'parado' : 'ativo'} há ${idle} dias`}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function ProjectsListPage() {
  const [projects, setProjects] = useState(() => projectService.listSorted());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProjectKind>('other');
  const [repoId, setRepoId] = useState('');
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [error, setError] = useState('');

  // Só busca quando o formulário abre E a natureza é código — ir na API do
  // GitHub para quem está cadastrando uma viagem seria chamada pura perda.
  useEffect(() => {
    if (!creating || kind !== 'code') return;
    setReposLoading(true);
    gitLogService.listRepos()
      .then(setRepos)
      .catch(() => setRepos([]))
      .finally(() => setReposLoading(false));
  }, [creating, kind]);

  function renameProject(project: Project, value: string) {
    projectService.update(project.id, { name: value });
    refresh();
  }

  function refresh() {
    setProjects(projectService.listSorted());
  }

  function create() {
    try {
      const repo = repos.find((r) => String(r.id) === repoId);
      projectService.create({ name, kind, repoId: repo?.id, repoName: repo?.name });
      setName('');
      setKind('other');
      setRepoId('');
      setCreating(false);
      setError('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar o projeto.');
    }
  }

  const stalled = projects.filter((p) => projectService.isStalled(p));

  return (
    <div className="space-y-4">
      {/* Sem `tabs`: a lista de projetos é uma tela só, e a tira de uma aba
          apontando para a própria página ocupava uma linha sem navegar. */}
      <ModuleHeader
        eyebrow="Módulo · Projetos"
        title="Projetos"
        right={
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {creating ? 'Cancelar' : '+ Novo'}
          </button>
        }
      />

      {creating && (
        <Card>
          <label>
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
              Nome do projeto
            </span>
            <input
              className="w-full"
              autoFocus
              value={name}
              placeholder="Ex.: Campanha de RPG"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
            />
          </label>
          <label className="mt-4 block">
            <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
              Natureza
            </span>
            <Select className="w-full" value={kind} onChange={(v) => setKind(v as ProjectKind)}>
              {(Object.keys(PROJECT_KIND_LABEL) as ProjectKind[]).map((k) => (
                <Select.Option key={k} value={k}>{PROJECT_KIND_LABEL[k]}</Select.Option>
              ))}
            </Select>
          </label>

          {/* Repositório é o único campo de código no formulário — some junto
              com a natureza, em vez de ficar como caixa "Não há git" que todo
              projeto não-código teria de ignorar. */}
          {kind === 'code' && (
            <label className="mt-4 block">
              <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                Repositório git
              </span>
              <Select className="w-full" value={repoId} onChange={setRepoId} disabled={reposLoading}>
                <Select.Option value="">Não há git</Select.Option>
                {repos.map((r) => <Select.Option key={r.id} value={String(r.id)}>{r.name}</Select.Option>)}
              </Select>
            </label>
          )}
          {error && <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
          <div className="mt-4">
            <button
              onClick={create}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Criar
            </button>
          </div>
        </Card>
      )}

      <StalledBanner projects={stalled} />

      {projects.length === 0 && !creating ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
            Nenhum projeto ainda. Um projeto é algo que você constrói ao longo do tempo, com frentes
            e tarefas — diferente de uma meta, que é um número com prazo.
          </p>
        </Card>
      ) : (
        projects.map((p) => <ProjectCard key={p.id} project={p} onRename={renameProject} />)
      )}

      {projects.length > 0 && (
        <p className="pt-2 text-center text-xs" style={{ color: 'var(--hub-disabled)' }}>
          <Chip>{projects.length}</Chip> projeto{projects.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}
