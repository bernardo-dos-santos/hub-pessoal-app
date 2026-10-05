import { storageAdapter } from '../../../core/storage/storage.adapter';
import { parseConventionalCommit } from './conventionalCommit';
import { gitLogService, type GitCommit } from './gitLogService';
import { readFronts, readProjects, touchAt } from './projectStorage';

const CURSOR_KEY_PREFIX = 'projects.gitSyncCursor:';
const SCAN_LIMIT = 300;
const BACKFILL_LIMIT = 60;

export type GitActivitySyncResult = {
  scanned: number;
  matched: number;
};

/**
 * Camada 1 do parser automático: pra cada repositório escolhido por algum
 * projeto, lê o log do git (regex, zero IA) e bate o escopo de cada commit
 * "tipo(escopo): ..." contra o `gitScope` das frentes DAQUELE MESMO projeto —
 * um projeto nunca casa escopo com o repositório de outro. Quando bate,
 * empurra `lastActivityAt` pra data do commit — nunca pra "agora" (touchAt
 * ignora datas mais antigas que a atual), senão reprocessar o histórico
 * faria uma frente parada parecer recém-mexida.
 *
 * Cursor por hash, um por repositório (`projects.gitSyncCursor:<repoName>`):
 * cada chamada só varre commits novos desde a última — idempotente e barato
 * o suficiente pra rodar a cada carregamento do app, como os outros
 * auto-imports em AppLayout.
 *
 * Usa o `repoName` em CACHE do projeto (não confere rename via API a cada
 * boot — isso é papel da página Atividade, que já resolve pelo `repoId` e
 * autocorrige o cache). Rodar isso pra todo projeto a cada carregamento do
 * app gastaria chamada de API à toa; se um repo foi renomeado, esta camada
 * só pega o nome novo depois que a Atividade dele for aberta uma vez.
 */
export async function syncGitActivity(): Promise<GitActivitySyncResult> {
  const fronts = readFronts().filter((f) => f.gitScope);
  if (fronts.length === 0) return { scanned: 0, matched: 0 };

  const projectRepoById = new Map(readProjects().map((p) => [p.id, p.repoName]));
  const frontsByRepo = new Map<string, typeof fronts>();
  for (const front of fronts) {
    const repoName = projectRepoById.get(front.projectId);
    if (!repoName) continue;
    const list = frontsByRepo.get(repoName) ?? [];
    list.push(front);
    frontsByRepo.set(repoName, list);
  }
  if (frontsByRepo.size === 0) return { scanned: 0, matched: 0 };

  let totalScanned = 0;
  let totalMatched = 0;

  for (const [repoName, repoFronts] of frontsByRepo) {
    const cursorKey = `${CURSOR_KEY_PREFIX}${repoName}`;
    const lastHash = storageAdapter.getItem<string>(cursorKey);

    let commits: GitCommit[];
    try {
      commits = await gitLogService.listCommits(repoName, { order: 'desc', limit: SCAN_LIMIT });
    } catch {
      continue; // repositório pode ter sido renomeado/apagado — não trava os outros
    }
    if (commits.length === 0) continue;

    const toProcess: GitCommit[] = [];
    for (const commit of commits) {
      if (lastHash && commit.hash === lastHash) break;
      toProcess.push(commit);
      if (!lastHash && toProcess.length >= BACKFILL_LIMIT) break;
    }
    storageAdapter.setItem(cursorKey, commits[0].hash);
    if (toProcess.length === 0) continue;

    // Do mais antigo pro mais novo, pra lastActivityAt terminar valendo a data do commit mais recente.
    for (const commit of [...toProcess].reverse()) {
      const parsed = parseConventionalCommit(commit.subject);
      if (!parsed?.scope) continue;
      for (const front of repoFronts) {
        if (front.gitScope !== parsed.scope) continue;
        touchAt(front.projectId, commit.date, front.id);
        totalMatched++;
      }
    }
    totalScanned += toProcess.length;
  }

  return { scanned: totalScanned, matched: totalMatched };
}
