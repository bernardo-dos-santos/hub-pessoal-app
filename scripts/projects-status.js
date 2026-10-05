// Resumo do módulo Projetos: projeto → frentes → tarefas/bugs/melhorias/decisões.
//
// Lê o hub.db local quando existir (ex.: rodando no PC dedicado, onde o server
// mora de verdade) e cai pro endpoint Tailscale do servidor 24/7 quando não —
// ex.: rodando do notebook, cujo hub.db local não tem os dados de produção.

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../hub.db');
// Endereço do servidor no tailnet, definido em HUB_BACKEND (ver .env.example).
const TAILSCALE_BACKEND = process.env.HUB_BACKEND ?? '';

// Mesmas chaves de src/modules/projects/services/projectStorage.ts (projectKeys),
// MENOS `projects.events`: este resumo não imprime histórico, e o log é a maior
// coleção do módulo — baixá-lo a cada chamada custaria payload à toa. O ramo que
// lê o hub.db local pega tudo por `LIKE 'projects.%'` e não precisa desta lista.
const PROJECTS_KEYS = ['projects.list', 'projects.fronts', 'projects.tasks', 'projects.issues', 'projects.decisions', 'projects.expansions', 'projects.milestones'];

async function loadProjectsStore() {
  if (existsSync(DB_PATH)) {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(DB_PATH);
    const rows = db.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'projects.%'").all();
    db.close();
    const store = {};
    for (const row of rows) store[row.key] = JSON.parse(row.value);
    // Linhas vazias (ex.: dev local sem uso real) não contam como dado de
    // produção — só usa o local se `projects.list` tiver projeto de verdade,
    // senão cai pro Tailscale como se o arquivo não existisse.
    if ((store['projects.list'] ?? []).length > 0) {
      return { store, source: `local (${DB_PATH})` };
    }
  }
  if (!TAILSCALE_BACKEND) {
    throw new Error('Sem hub.db local com dados e sem HUB_BACKEND definido (endereço do servidor no tailnet, veja .env.example).');
  }
  // Busca só as chaves projects.* uma a uma — nunca o snapshot completo do
  // store (que traria finance, study, etc. junto sem necessidade).
  const store = {};
  for (const key of PROJECTS_KEYS) {
    const value = await fetchRemoteKey(key);
    if (value !== undefined) store[key] = value;
  }
  return { store, source: `${TAILSCALE_BACKEND} (chaves projects.*)` };
}

function fetchRemoteKey(key) {
  return new Promise((resolvePromise, reject) => {
    const req = https
      .get(`${TAILSCALE_BACKEND}/api/store/${key}`, (res) => {
        if (res.statusCode === 404) {
          res.resume();
          resolvePromise(undefined);
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolvePromise(JSON.parse(data).value);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error(`Timeout ao buscar ${key} no servidor dedicado (Tailscale offline?)`)));
  });
}

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : '?';
}

function taskMark(status) {
  return status === 'done' ? '[x]' : '[ ]';
}

async function main() {
  const { store, source } = await loadProjectsStore();
  const projects = store['projects.list'] ?? [];
  const fronts = store['projects.fronts'] ?? [];
  const tasks = store['projects.tasks'] ?? [];
  const issues = store['projects.issues'] ?? [];
  const decisions = store['projects.decisions'] ?? [];
  const expansions = store['projects.expansions'] ?? [];
  const milestones = store['projects.milestones'] ?? [];

  console.log(`Fonte: ${source}\n`);

  if (projects.length === 0) {
    console.log('Nenhum projeto cadastrado.');
    return;
  }

  for (const project of projects) {
    console.log(`# ${project.name} (${project.status}) — última atividade ${formatDate(project.lastActivityAt)}`);

    const projectFronts = fronts.filter((f) => f.projectId === project.id);
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const projectIssues = issues.filter((i) => i.projectId === project.id);
    const projectDecisions = decisions.filter((d) => d.projectId === project.id);
    const projectExpansions = expansions.filter((e) => e.projectId === project.id);
    const projectMilestones = milestones.filter((m) => m.projectId === project.id);

    // Marcos primeiro: é a leitura de progresso que não depende de contagem de
    // tarefa, e portanto a que faz sentido em projeto que não é código.
    if (projectMilestones.length > 0) {
      const reached = projectMilestones.filter((m) => m.reachedAt).length;
      console.log(`\n  Marcos (${reached}/${projectMilestones.length}):`);
      for (const milestone of projectMilestones) {
        const when = milestone.targetDate ? ` — ${milestone.targetDate}` : '';
        console.log(`    ${milestone.reachedAt ? '[x]' : '[ ]'} ${milestone.title}${when}`);
      }
    }

    for (const front of projectFronts) {
      const frontTasks = projectTasks.filter((t) => t.frontId === front.id);
      const phase = front.phase ? ` [${front.phase === 'figuring' ? 'descobrindo' : 'executando'}]` : '';
      console.log(`\n  Frente: ${front.name} (${front.status})${phase} — última atividade ${formatDate(front.lastActivityAt)}`);
      const nextAction = projectTasks.find((t) => t.id === front.nextActionTaskId);
      if (nextAction) console.log(`    → próxima ação: ${nextAction.title}`);
      if (frontTasks.length === 0) console.log('    (sem tarefas)');
      for (const task of frontTasks) console.log(`    ${taskMark(task.status)} ${task.title}`);
    }

    const looseTasks = projectTasks.filter((t) => !t.frontId);
    if (looseTasks.length > 0) {
      console.log('\n  Tarefas sem frente:');
      for (const task of looseTasks) console.log(`    ${taskMark(task.status)} ${task.title}`);
    }

    if (projectIssues.length > 0) {
      console.log('\n  Bugs e melhorias:');
      for (const issue of projectIssues) {
        const kind = issue.kind === 'bug' ? 'BUG' : 'MELHORIA';
        console.log(`    [${kind}/${issue.status}] ${issue.title}`);
      }
    }

    if (projectDecisions.length > 0) {
      console.log('\n  Decisões:');
      for (const decision of projectDecisions) {
        console.log(`    - ${decision.title ?? decision.what}: ${decision.why}`);
      }
    }

    if (projectExpansions.length > 0) {
      console.log('\n  Expansões (backlog de ideias):');
      for (const exp of projectExpansions) {
        const feas = exp.feasibility ? `/${exp.feasibility}` : '';
        console.log(`    [${exp.status}${feas}] ${exp.title}`);
      }
    }

    console.log('');
  }
}

main().catch((err) => {
  console.error('Falha ao carregar status de Projetos:', err.message);
  process.exit(1);
});
