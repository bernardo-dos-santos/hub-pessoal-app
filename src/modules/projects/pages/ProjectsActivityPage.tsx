import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { projectService } from '../services/projectService';
import { gitLogService, type GitCommit, type GitLogOrder } from '../services/gitLogService';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Log bruto de commits do repositório DESTE projeto (via API do GitHub) —
 * todas as branches, sem tentar agrupar por frente. Só um filtro por branch
 * e a ordem. A inteligência de mapear commit → frente automaticamente é a
 * camada 1 (`gitActivitySyncService`), separada disto.
 *
 * Antes de buscar qualquer commit, resolve o `repoId` na API — é a âncora de
 * identidade de verdade (sobrevive a rename, ao contrário de um caminho ou
 * nome guardado). Se o nome atual vier diferente do que está em cache no
 * projeto, atualiza sozinho (rename no GitHub se autocorrige aqui). Se o
 * repositório não existir mais (apagado, ou o token perdeu acesso), mostra
 * aviso em vez de tela vazia.
 */
export function ProjectsActivityPage() {
  const { projectId = '' } = useParams();
  const project = projectService.getById(projectId);

  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('');
  const [order, setOrder] = useState<GitLogOrder>('desc');
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [repoFullName, setRepoFullName] = useState<string | null>(null);
  const [repoMissing, setRepoMissing] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(true);

  const repoId = project?.repoId;

  useEffect(() => {
    if (repoId == null) { setIdentityLoading(false); return; }
    setIdentityLoading(true);
    gitLogService.verifyRepo(repoId)
      .then((identity) => {
        if (!identity.exists || !identity.fullName) {
          setRepoMissing(true);
          return;
        }
        setRepoMissing(false);
        setRepoFullName(identity.fullName);
        // Rename no GitHub — atualiza o cache local sozinho, sem o usuário precisar fazer nada.
        if (project && identity.fullName !== project.repoName) {
          projectService.update(project.id, { repoName: identity.fullName });
        }
      })
      .catch(() => setRepoMissing(true))
      .finally(() => setIdentityLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId]);

  useEffect(() => {
    if (!repoFullName) return;
    gitLogService.listBranches(repoFullName).then(setBranches).catch(() => setBranches([]));
  }, [repoFullName]);

  useEffect(() => {
    if (!repoFullName) { setLoading(false); return; }
    setLoading(true);
    setError('');
    gitLogService
      .listCommits(repoFullName, { branch: branch || undefined, order })
      .then(setCommits)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar o log.'))
      .finally(() => setLoading(false));
  }, [repoFullName, branch, order]);

  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Atividade" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Atividade"
        tabs={getProjectTabs(project)}
        back
      />

      {repoId == null ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
            Este projeto não está vinculado a um repositório git — não há commits pra mostrar.
          </p>
        </Card>
      ) : identityLoading ? (
        <Card>
          <p className="animate-pulse text-center text-xs" style={{ color: 'var(--hub-subtle)' }}>Verificando repositório…</p>
        </Card>
      ) : repoMissing ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-warning)' }}>
            Não encontramos mais este repositório no GitHub — pode ter sido apagado, ou o token perdeu
            acesso a ele.
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Repositório: {repoFullName}</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="min-w-[180px] flex-1">
                <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                  Branch
                </span>
                <Select className="w-full" value={branch} onChange={setBranch}>
                  <Select.Option value="">Todas</Select.Option>
                  {branches.map((b) => <Select.Option key={b} value={b}>{b}</Select.Option>)}
                </Select>
              </label>

              <label className="min-w-[160px] flex-1">
                <span style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>
                  Ordem
                </span>
                <Select className="w-full" value={order} onChange={(value) => setOrder(value as GitLogOrder)}>
                  <Select.Option value="desc">Mais recentes primeiro</Select.Option>
                  <Select.Option value="asc">Mais antigos primeiro</Select.Option>
                </Select>
              </label>
            </div>
          </Card>

          {error && (
            <Card>
              <p className="text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>
            </Card>
          )}

          {loading ? (
            <Card>
              <p className="animate-pulse text-center text-xs" style={{ color: 'var(--hub-subtle)' }}>Carregando…</p>
            </Card>
          ) : commits.length === 0 && !error ? (
            <Card>
              <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Nenhum commit encontrado.</p>
            </Card>
          ) : (
            <Card>
              {commits.map((commit, i) => (
                <div
                  key={commit.hash}
                  className="flex items-start gap-3 py-2.5"
                  style={{ borderBottom: i === commits.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
                >
                  <span className="shrink-0 pt-0.5 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                    {commit.shortHash}
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-5" style={{ color: 'var(--hub-text)' }}>
                    {commit.subject}
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px]" style={{ color: 'var(--hub-subtle)' }}>{commit.author}</p>
                    <p className="text-[10px] tabular-nums" style={{ color: 'var(--hub-disabled)' }}>
                      {formatDateTime(commit.date)}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
