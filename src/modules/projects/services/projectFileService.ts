import { apiUrl } from '../../../core/config/backendConfig';
import { touch } from './projectStorage';
import { type ProjectFile } from '../types/projectFile';

export const PROJECT_FILE_MAX_SIZE_BYTES = 20 * 1024 * 1024;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Erro ao consultar o servidor.');
  }
  return res.json() as Promise<T>;
}

/**
 * Bytes não passam pelo storageAdapter (kv_store não é lugar pra binário —
 * ver server/index.js, seção "Arquivos de Projeto"). Este serviço fala
 * direto com a API de arquivos; só `touch()` (via projectStorage) mexe no
 * kv_store, pra marcar atividade no projeto/frente.
 */
export const projectFileService = {
  async listByProject(projectId: string): Promise<ProjectFile[]> {
    const { files } = await fetchJson<{ files: ProjectFile[] }>(`/api/projects/${projectId}/files`);
    return files;
  },

  async upload(projectId: string, file: File, frontId?: string): Promise<ProjectFile> {
    if (file.size > PROJECT_FILE_MAX_SIZE_BYTES) {
      throw new Error('Arquivo maior que 20MB — não é possível anexar.');
    }
    const qs = frontId ? `?frontId=${encodeURIComponent(frontId)}` : '';
    const meta = await fetchJson<ProjectFile>(`/api/projects/${projectId}/files${qs}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });
    touch(projectId, frontId);
    return meta;
  },

  downloadUrl(fileId: string): string {
    return apiUrl(`/api/projects/files/${fileId}/download`);
  },

  /**
   * Mesma rota, com `?inline=1` — o servidor troca o Content-Disposition de
   * `attachment` para `inline`. Sem isso o navegador é obrigado a baixar e o
   * visualizador não recebe bytes nenhum.
   */
  inlineUrl(fileId: string): string {
    return apiUrl(`/api/projects/files/${fileId}/download?inline=1`);
  },

  /** Páginas, palavras e primeiras linhas — via pdf-parse no servidor, sem IA. */
  async pdfInfo(fileId: string): Promise<{ pages: number | null; words: number; preview: string }> {
    return fetchJson(`/api/projects/files/${fileId}/pdf-info`);
  },

  /** Conteúdo cru de anexo de texto/Markdown — o próprio arquivo é a resposta. */
  async readText(fileId: string): Promise<string> {
    const res = await fetch(apiUrl(`/api/projects/files/${fileId}/download?inline=1`));
    if (!res.ok) throw new Error('Não foi possível ler o arquivo.');
    return res.text();
  },

  async remove(fileId: string): Promise<void> {
    await fetchJson(`/api/projects/files/${fileId}`, { method: 'DELETE' });
  },
};
