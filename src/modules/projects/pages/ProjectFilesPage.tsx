import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { getProjectTabs, projectEyebrow } from '../components/projectTabs';
import { isViewableFile } from '../types/projectFile';
import { frontService } from '../services/frontService';
import { projectFileService } from '../services/projectFileService';
import { projectService } from '../services/projectService';
import { type ProjectFile } from '../types/projectFile';

const LABEL_STYLE = {
  fontSize: '10px', fontWeight: 500, textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', color: 'var(--hub-subtle)',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProjectFilesPage() {
  const { projectId = '' } = useParams();
  const project = projectService.getById(projectId);

  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [frontId, setFrontId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fronts = project ? frontService.listByProject(project.id) : [];

  async function load() {
    if (!project) return;
    try {
      setFiles(await projectFileService.listByProject(project.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar arquivos.');
    }
  }

  useEffect(() => {
    load();
  }, [projectId]);

  if (!project) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Projetos" title="Arquivos" back />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Projeto não encontrado.</p></Card>
      </div>
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await projectFileService.upload(project!.id, file, frontId || undefined);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao anexar arquivo.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(file: ProjectFile) {
    if (!confirm(`Excluir "${file.fileName}"?`)) return;
    try {
      await projectFileService.remove(file.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir.');
    }
  }

  return (
    <div className="space-y-4">
      <ModuleHeader
        eyebrow={projectEyebrow(project)}
        title="Arquivos"
        tabs={getProjectTabs(project)}
        back
      />

      <Card>
        {fronts.length > 0 && (
          <label className="block">
            <span style={LABEL_STYLE}>Frente (opcional)</span>
            <Select className="w-full" value={frontId} onChange={setFrontId}>
              <Select.Option value="">O projeto todo</Select.Option>
              {fronts.map((f) => <Select.Option key={f.id} value={f.id}>{f.name}</Select.Option>)}
            </Select>
          </label>
        )}
        <label
          className="mt-4 inline-block text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)', cursor: uploading ? 'default' : 'pointer' }}
        >
          {uploading ? 'Enviando…' : '+ Anexar arquivo'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        <p className="mt-2 text-xs" style={{ color: 'var(--hub-disabled)' }}>Até 20MB por arquivo.</p>
        {error && <p className="mt-3 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
      </Card>

      {files === null ? (
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Carregando…</p></Card>
      ) : files.length === 0 ? (
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Nenhum arquivo anexado ainda.</p></Card>
      ) : (
        files.map((file) => {
          const front = file.frontId ? fronts.find((f) => f.id === file.frontId) : null;
          return (
            <Card key={file.id}>
              <div className="flex items-baseline justify-between gap-3">
                {/* PDF abre no visualizador; o resto continua baixando, que é
                    tudo que dá para fazer com um .zip ou .xlsx. */}
                {isViewableFile(file) ? (
                  <Link
                    to={`/projetos/${project.id}/arquivos/${file.id}`}
                    className="min-w-0 flex-1 truncate text-sm transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-text)' }}
                  >
                    {file.fileName}
                  </Link>
                ) : (
                  <a
                    href={projectFileService.downloadUrl(file.id)}
                    className="min-w-0 flex-1 truncate text-sm transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-text)' }}
                    download={file.fileName}
                  >
                    {file.fileName}
                  </a>
                )}
                <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
                  {formatSize(file.sizeBytes)}
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                {front?.name ?? 'projeto todo'} · {formatDate(file.createdAt)}
              </p>
              <div className="mt-3 flex items-baseline gap-4">
                {isViewableFile(file) && (
                  <a
                    href={projectFileService.downloadUrl(file.id)}
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)' }}
                    download={file.fileName}
                  >
                    baixar
                  </a>
                )}
                <button
                  onClick={() => remove(file)}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  excluir
                </button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
