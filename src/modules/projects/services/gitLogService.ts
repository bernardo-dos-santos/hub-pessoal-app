import { apiUrl } from '../../../core/config/backendConfig';
import { restoreAccents } from './ptAccents';

export type GitCommit = {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
};

export type GitRepo = {
  id: number;
  /** "dono/repositório" */
  name: string;
  defaultBranch: string;
};

export type RepoIdentity = {
  exists: boolean;
  /** Nome atual "dono/repositório" — pode ter mudado desde que o projeto foi vinculado (rename no GitHub). */
  fullName: string | null;
};

export type GitLogOrder = 'asc' | 'desc';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Erro ao consultar o servidor.');
  }
  return res.json() as Promise<T>;
}

export const gitLogService = {
  /** Repositórios do usuário no GitHub — pro seletor na criação de um Projeto. */
  async listRepos(): Promise<GitRepo[]> {
    const { repos } = await fetchJson<{ repos: GitRepo[] }>('/api/git/repos');
    return repos;
  },

  /** Confere se o projeto ainda aponta pro mesmo repositório (pelo id — sobrevive a rename). */
  async verifyRepo(repoId: number): Promise<RepoIdentity> {
    return fetchJson<RepoIdentity>(`/api/git/verify?repoId=${repoId}`);
  },

  async listBranches(repoFullName: string): Promise<string[]> {
    const { branches } = await fetchJson<{ branches: string[] }>(`/api/git/branches?repo=${encodeURIComponent(repoFullName)}`);
    return branches;
  },

  async listCommits(repoFullName: string, opts: { branch?: string; order?: GitLogOrder; limit?: number } = {}): Promise<GitCommit[]> {
    const params = new URLSearchParams({ repo: repoFullName });
    if (opts.branch) params.set('branch', opts.branch);
    if (opts.order) params.set('order', opts.order);
    if (opts.limit) params.set('limit', String(opts.limit));
    const { commits } = await fetchJson<{ commits: GitCommit[] }>(`/api/git/log?${params.toString()}`);
    // Restaura acentos que o commit em si não tem — troca por dicionário, sem IA.
    return commits.map((commit) => ({ ...commit, subject: restoreAccents(commit.subject) }));
  },
};
