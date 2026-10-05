// server/githubApi.js
// Integração com a API do GitHub — descoberta de repositório e log de commits
// direto da fonte, em vez de vasculhar pasta e rodar `git` local. Substitui
// server/gitLog.js + server/repoDiscovery.js:
//
// - Não depende de o repositório estar clonado na MESMA máquina que roda o
//   backend (era o problema real: o PC dedicado só tinha o Hub-Pessoal
//   clonado, os outros projetos do Bernardo só existiam no notebook).
// - Nunca fica desatualizado por clone parado — reflete o que foi empurrado
//   pro GitHub, sem `git pull` de ninguém.
// - Usa o `id` numérico do repositório (nunca muda, nem com rename) como
//   âncora de identidade — mais forte que comparar URL de remoto.
//
// Requer GITHUB_TOKEN no .env (fine-grained, permissões Contents + Metadata,
// somente leitura).

const GITHUB_API = 'https://api.github.com';

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN não configurado no .env.');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubFetch(path) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message ?? `GitHub API respondeu ${res.status}.`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Repositórios do usuário autenticado (dono + colaborador) — alimenta o seletor na criação de um Projeto. */
export async function discoverRepos() {
  const repos = await githubFetch('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator');
  return repos.map((r) => ({ id: r.id, name: r.full_name, defaultBranch: r.default_branch }));
}

/**
 * Confere se um projeto ainda aponta pro mesmo repositório — busca pelo `id`
 * em vez de pelo nome, então rename no GitHub não quebra o vínculo (a busca
 * por id resolve pro nome atual sozinha; quem chama atualiza o cache do nome).
 * "Não existe mais" cobre tanto apagado quanto o token ter perdido acesso —
 * o GitHub devolve 404 pros dois casos, pra não vazar existência de repo
 * privado que o token não alcança.
 */
export async function checkRepoIdentity(repoId) {
  try {
    const repo = await githubFetch(`/repositories/${repoId}`);
    return { exists: true, fullName: repo.full_name, defaultBranch: repo.default_branch };
  } catch (err) {
    if (err.status === 404) return { exists: false, fullName: null, defaultBranch: null };
    throw err;
  }
}

export async function listBranches(fullName) {
  const branches = await githubFetch(`/repos/${fullName}/branches?per_page=100`);
  return branches.map((b) => b.name);
}

/**
 * Commits mais recentes primeiro por padrão. `order: 'asc'` NÃO busca os
 * commits mais antigos do projeto — pega o mesmo lote (os `limit` mais
 * recentes) e só inverte a ordem de exibição, igual ao comportamento antigo
 * baseado em `git log --reverse -n`.
 */
export async function getCommits(fullName, { branch, order = 'desc', limit = 200 } = {}) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 200, 1), 300);
  const commits = [];
  let page = 1;
  while (commits.length < boundedLimit) {
    const perPage = Math.min(100, boundedLimit - commits.length);
    const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
    if (branch) params.set('sha', branch);
    const batch = await githubFetch(`/repos/${fullName}/commits?${params}`);
    if (batch.length === 0) break;
    commits.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  const mapped = commits.map((c) => ({
    hash: c.sha,
    shortHash: c.sha.slice(0, 7),
    author: c.commit.author?.name ?? c.author?.login ?? 'desconhecido',
    date: c.commit.author?.date ?? '',
    subject: c.commit.message.split('\n')[0],
  }));
  return order === 'asc' ? mapped.reverse() : mapped;
}
