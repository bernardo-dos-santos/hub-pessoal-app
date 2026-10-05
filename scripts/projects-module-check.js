// Check de sanidade do módulo Projetos.
//
// Exercita os services de verdade (não lê fonte procurando string) para cobrir
// os invariantes que quebram em silêncio: histórico de eventos, cascade de
// exclusão e a marca de próxima ação apontando para tarefa que já morreu.
// Nenhum deles quebra a tela quando falha — a informação só passa a mentir.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const modulePath = (...parts) => path.join(projectRoot, "src", "modules", "projects", ...parts);

// localStorage em memória: o storageAdapter cai no localStorageAdapter quando
// não há bootstrap, e ele exige `window`. Sem este shim todo setItem vira
// no-op e os asserts passariam por engano, testando nada.
const memory = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, String(v)),
    removeItem: (k) => memory.delete(k),
    clear: () => memory.clear(),
  },
};

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(transpiled.outputText, filename);
};

const { projectService } = require(modulePath("services", "projectService.ts"));
const { frontService } = require(modulePath("services", "frontService.ts"));
const { projectTaskService } = require(modulePath("services", "projectTaskService.ts"));
const { projectIssueService } = require(modulePath("services", "projectIssueService.ts"));
const { projectExpansionService } = require(modulePath("services", "projectExpansionService.ts"));
const { projectMilestoneService } = require(modulePath("services", "projectMilestoneService.ts"));
const { projectAlertProvider } = require(modulePath("alerts", "projectAlertProvider.ts"));
const { projectMetricsService } = require(modulePath("services", "projectMetricsService.ts"));
const { readEvents, projectKeys } = require(modulePath("services", "projectStorage.ts"));
const { resolveKind, isCodeProject } = require(modulePath("types", "project.ts"));
const { isTaskOverdue, isTaskDueSoon } = require(modulePath("types", "projectTask.ts"));
const { isViewableFile, viewerKindFor } = require(modulePath("types", "projectFile.ts"));
const { DEFAULT_EXPANSION_CATEGORY, expansionCategoryLabel } = require(modulePath("types", "projectExpansion.ts"));

const eventsFor = (projectId, entityId) =>
  readEvents().filter((e) => e.projectId === projectId && (!entityId || e.entityId === entityId));

// ─── Natureza do projeto ──────────────────────────────────────────────────────

const code = projectService.create({ name: "Projeto de código", kind: "code", repoId: 42, repoName: "dono/repo" });
const personal = projectService.create({ name: "Reforma do quarto", kind: "personal" });

assert.equal(isCodeProject(code), true, "Projeto 'code' deve contar como projeto de código");
assert.equal(isCodeProject(personal), false, "Projeto 'personal' NAO deve contar como projeto de código");
assert.equal(personal.repoId, undefined, "Projeto não-código não deve gravar repositório mesmo se vier no input");

const comRepoSemKind = { kind: undefined, repoId: 7 };
const semRepoSemKind = { kind: undefined, repoId: undefined };
assert.equal(resolveKind(comRepoSemKind), "code", "Projeto legado COM repoId deve ser resolvido como código");
assert.equal(resolveKind(semRepoSemKind), "other", "Projeto legado SEM repoId deve ser resolvido como outro");

// Repositório só é aceito quando a natureza é código — senão viraria dado morto
// que reapareceria se a natureza mudasse depois.
const falsoCode = projectService.create({ name: "Sem git", kind: "creative", repoId: 99, repoName: "dono/x" });
assert.equal(falsoCode.repoName, undefined, "Natureza não-código deve descartar repoName junto com repoId");

// ─── Histórico de eventos ─────────────────────────────────────────────────────

assert.equal(
  eventsFor(code.id, code.id).some((e) => e.kind === "created"),
  true,
  "Criar projeto deve gravar evento 'created'",
);

const front = frontService.create(code.id, "Multiusuário");
const pai = projectTaskService.create({ projectId: code.id, title: "Comprar domínio", frontId: front.id });
const filha = projectTaskService.create({
  projectId: code.id, title: "Ver preço no registro.br", frontId: front.id, parentTaskId: pai.id,
});

assert.equal(eventsFor(code.id, pai.id).some((e) => e.kind === "created"), true, "Criar tarefa deve gravar evento");

projectTaskService.setStatus(pai.id, "done");
const eventosPai = eventsFor(code.id, pai.id).filter((e) => e.kind === "status_changed");
const eventosFilha = eventsFor(code.id, filha.id).filter((e) => e.kind === "status_changed");
assert.equal(eventosPai.length, 1, "Fechar tarefa deve gravar UM evento de mudança de status");
assert.equal(eventosPai[0].from, "todo", "Evento deve registrar o estado anterior");
assert.equal(eventosPai[0].to, "done", "Evento deve registrar o estado novo");
assert.equal(
  eventosFilha.length,
  1,
  "Subtarefa fechada em cascata também deve gravar evento — senão o ritmo semanal conta uma onde fecharam várias",
);

// Reabrir e fechar de novo não pode gravar evento quando o status não mudou.
const antes = eventsFor(code.id, pai.id).length;
projectTaskService.setStatus(pai.id, "done");
assert.equal(eventsFor(code.id, pai.id).length, antes, "Status igual ao atual não deve gravar evento");

// ─── Próxima ação ─────────────────────────────────────────────────────────────

const aberta = projectTaskService.create({ projectId: code.id, title: "Configurar Cloudflare", frontId: front.id });
frontService.update(front.id, { nextActionTaskId: aberta.id });
assert.equal(frontService.getById(front.id).nextActionTaskId, aberta.id, "Frente deve guardar a próxima ação");
assert.equal(
  projectTaskService.getNextAction(aberta.id).title,
  "Configurar Cloudflare",
  "getNextAction deve devolver a tarefa apontada",
);

projectTaskService.setStatus(aberta.id, "done");
assert.equal(
  frontService.getById(front.id).nextActionTaskId,
  undefined,
  "Fechar a tarefa deve soltar a marca de próxima ação — senão a frente exibe como próximo passo algo já concluído",
);

// Mesma garantia no caminho de exclusão, e para tarefa solta (marca no projeto).
const solta = projectTaskService.create({ projectId: personal.id, title: "Medir a parede" });
projectService.update(personal.id, { nextActionTaskId: solta.id });
assert.equal(projectService.getById(personal.id).nextActionTaskId, solta.id, "Projeto deve guardar próxima ação solta");
projectTaskService.remove(solta.id);
assert.equal(
  projectService.getById(personal.id).nextActionTaskId,
  undefined,
  "Apagar a tarefa deve soltar a marca de próxima ação do projeto",
);

// Subtarefa marcada e fechada junto com a mãe também precisa soltar a marca.
const mae = projectTaskService.create({ projectId: code.id, title: "Mãe", frontId: front.id });
const sub = projectTaskService.create({ projectId: code.id, title: "Filha", frontId: front.id, parentTaskId: mae.id });
frontService.update(front.id, { nextActionTaskId: sub.id });
projectTaskService.setStatus(mae.id, "done");
assert.equal(
  frontService.getById(front.id).nextActionTaskId,
  undefined,
  "Subtarefa fechada em cascata deve soltar a marca de próxima ação",
);

// ─── Fase de incerteza ────────────────────────────────────────────────────────

frontService.update(front.id, { phase: "figuring" });
assert.equal(frontService.getById(front.id).phase, "figuring", "Frente deve guardar a fase");
frontService.update(front.id, { phase: undefined });
assert.equal(frontService.getById(front.id).phase, undefined, "Deve ser possível voltar a frente para fase indefinida");

// ─── Prazo e adiamento ────────────────────────────────────────────────────────

const comPrazo = projectTaskService.create({ projectId: code.id, title: "Com prazo", frontId: front.id });
projectTaskService.setDueDate(comPrazo.id, "2026-09-01");
assert.equal(
  projectTaskService.listByProject(code.id).find((t) => t.id === comPrazo.id).dueMoveCount,
  undefined,
  "Definir prazo pela primeira vez NAO conta como adiamento",
);

projectTaskService.setDueDate(comPrazo.id, "2026-09-10");
projectTaskService.setDueDate(comPrazo.id, "2026-09-20");
const adiada = projectTaskService.listByProject(code.id).find((t) => t.id === comPrazo.id);
assert.equal(adiada.dueMoveCount, 2, "Empurrar o prazo para frente deve incrementar o contador");
assert.equal(
  eventsFor(code.id, comPrazo.id).filter((e) => e.kind === "due_moved").length,
  2,
  "Cada adiamento deve virar evento",
);

projectTaskService.setDueDate(comPrazo.id, "2026-09-05");
assert.equal(
  projectTaskService.listByProject(code.id).find((t) => t.id === comPrazo.id).dueMoveCount,
  2,
  "Antecipar o prazo NAO deve contar como adiamento",
);

assert.equal(isTaskOverdue({ dueDate: "2026-01-01", status: "todo" }, "2026-08-16"), true, "Prazo no passado com tarefa aberta é vencida");
assert.equal(isTaskOverdue({ dueDate: "2026-01-01", status: "done" }, "2026-08-16"), false, "Tarefa fechada nunca conta como vencida");
assert.equal(isTaskOverdue({ status: "todo" }, "2026-08-16"), false, "Tarefa sem prazo nunca conta como vencida");
assert.equal(isTaskDueSoon({ dueDate: "2026-08-18", status: "todo" }, "2026-08-16"), true, "Prazo em 2 dias conta como próximo");
assert.equal(isTaskDueSoon({ dueDate: "2026-08-25", status: "todo" }, "2026-08-16"), false, "Prazo em 9 dias não conta como próximo");
assert.equal(isTaskDueSoon({ dueDate: "2026-01-01", status: "todo" }, "2026-08-16"), false, "Vencida não deve também contar como próxima");

// ─── Marcos ───────────────────────────────────────────────────────────────────

const marco = projectMilestoneService.create({ projectId: code.id, title: "Arco 1 encerrado", targetDate: "2026-09-30" });
const semData = projectMilestoneService.create({ projectId: code.id, title: "Sem data" });
const vencido = projectMilestoneService.create({ projectId: code.id, title: "Vencido", targetDate: "2020-01-01" });

const ordenados = projectMilestoneService.listByProject(code.id);
assert.equal(
  ordenados[ordenados.length - 1].id,
  semData.id,
  "Marco sem data deve ir para o fim — sem data não significa urgente nem distante",
);
assert.equal(ordenados[0].id, vencido.id, "Marco com data mais antiga deve vir primeiro");

assert.equal(projectMilestoneService.getProgress(code.id).total, 3, "Progresso deve contar todos os marcos");
assert.equal(projectMilestoneService.getProgress(code.id).reached, 0, "Nenhum marco deve nascer atingido");

projectMilestoneService.toggleReached(marco.id);
assert.equal(projectMilestoneService.getProgress(code.id).reached, 1, "Atingir marco deve subir o progresso");
projectMilestoneService.toggleReached(marco.id);
assert.equal(
  projectMilestoneService.getProgress(code.id).reached,
  0,
  "Clicar de novo deve desfazer — marco marcado por engano é comum",
);

assert.equal(
  projectMilestoneService.listOverdue(code.id).map((m) => m.id).includes(vencido.id),
  true,
  "Marco com data no passado e não atingido deve contar como vencido",
);
projectMilestoneService.toggleReached(vencido.id);
assert.equal(
  projectMilestoneService.listOverdue(code.id).length,
  0,
  "Marco atingido não deve mais contar como vencido, mesmo com data no passado",
);

projectMilestoneService.update(marco.id, { targetDate: "2026-12-31" });
assert.equal(
  eventsFor(code.id, marco.id).filter((e) => e.kind === "due_moved").length,
  1,
  "Empurrar a data do marco deve virar evento — é o sinal mais honesto de plano furando",
);

// ─── Categoria de expansão livre ──────────────────────────────────────────────

projectExpansionService.create({ projectId: personal.id, title: "Iluminação", category: "Elétrica", complexity: "low" });
projectExpansionService.create({ projectId: personal.id, title: "Tomadas", category: "elétrica", complexity: "low" });
projectExpansionService.create({ projectId: personal.id, title: "Sem rótulo", category: "  ", complexity: "low" });

const categorias = projectExpansionService.listCategories(personal.id);
assert.equal(
  categorias.filter((c) => c.toLowerCase() === "elétrica").length,
  1,
  "Categorias devem deduplicar ignorando maiúsculas, para não criar dois grupos do mesmo assunto",
);
assert.equal(
  categorias.includes(DEFAULT_EXPANSION_CATEGORY),
  true,
  "Categoria vazia deve cair no rótulo padrão, para a ideia nunca ficar fora de um agrupamento",
);
assert.equal(
  expansionCategoryLabel("jarvis"),
  "Jarvis & Automação",
  "Slug antigo deve continuar exibindo o rótulo por extenso",
);
assert.equal(
  expansionCategoryLabel("Marcenaria"),
  "Marcenaria",
  "Categoria nova deve ser exibida como foi digitada",
);

// ─── Promoção de melhoria a tarefa ────────────────────────────────────────────

const issue = projectIssueService.create({ projectId: personal.id, title: "Ver se cabe estante", kind: "improvement" });
const promovida = projectIssueService.promoteToTask(issue.id);
assert.notEqual(promovida, null, "Promover melhoria deve devolver a tarefa criada");
assert.equal(
  eventsFor(personal.id, promovida.taskId).some((e) => e.kind === "created"),
  true,
  "Promoção deve gravar o nascimento da tarefa — é o que a taxa de aproveitamento do inbox mede",
);
assert.equal(projectIssueService.promoteToTask(issue.id), null, "Promover duas vezes deve ser no-op");

// ─── Métricas ─────────────────────────────────────────────────────────────────

const metricsProject = projectService.create({ name: "Projeto com métricas", kind: "other" });

assert.equal(
  projectMetricsService.historyStartsAt("projeto-inexistente"),
  null,
  "Projeto sem histórico deve devolver null, não uma data inventada",
);
assert.notEqual(
  projectMetricsService.historyStartsAt(metricsProject.id),
  null,
  "Criar o projeto já grava evento, então o histórico começa aí",
);

const m1 = projectTaskService.create({ projectId: metricsProject.id, title: "M1" });
const m2 = projectTaskService.create({ projectId: metricsProject.id, title: "M2" });
projectTaskService.create({ projectId: metricsProject.id, title: "M3 aberta" });
projectTaskService.setStatus(m1.id, "done");
projectTaskService.setStatus(m2.id, "done");

const semanas = projectMetricsService.closedByWeek(metricsProject.id, 12);
assert.equal(semanas.length, 12, "Deve devolver uma barra por semana pedida");
assert.equal(
  semanas[semanas.length - 1].count,
  2,
  "As duas tarefas fechadas hoje devem cair na semana corrente",
);
assert.equal(
  semanas.slice(0, -1).every((p) => p.count === 0),
  true,
  "Semanas sem fechamento devem aparecer como zero — senão o gráfico comprime o tempo",
);
assert.equal(
  semanas.every((p, i) => i === 0 || p.weekStart > semanas[i - 1].weekStart),
  true,
  "Semanas devem sair em ordem cronológica",
);

// Fechar de novo o que já estava fechado não pode inflar o ritmo.
const antesDeRefechar = projectMetricsService.closedByWeek(metricsProject.id, 12).at(-1).count;
projectTaskService.setStatus(m1.id, "done");
assert.equal(
  projectMetricsService.closedByWeek(metricsProject.id, 12).at(-1).count,
  antesDeRefechar,
  "Refechar tarefa já fechada não deve contar de novo no ritmo",
);

// Reabrir e fechar de novo CONTA duas vezes: o trabalho aconteceu duas vezes.
projectTaskService.setStatus(m1.id, "todo");
projectTaskService.setStatus(m1.id, "done");
assert.equal(
  projectMetricsService.closedByWeek(metricsProject.id, 12).at(-1).count,
  antesDeRefechar + 1,
  "Reabrir e fechar de novo deve contar outra vez — o fechamento aconteceu de novo",
);

const idades = projectMetricsService.openTaskAging(metricsProject.id);
assert.equal(idades.reduce((s, b) => s + b.count, 0), 1, "Só a tarefa aberta deve entrar no envelhecimento");
assert.equal(idades[0].count, 1, "Tarefa criada agora deve cair na faixa mais nova");

assert.equal(
  projectMetricsService.medianDaysToClose(metricsProject.id),
  0,
  "Tarefa criada e fechada no mesmo dia deve dar mediana 0, não null",
);
assert.equal(
  projectMetricsService.medianDaysToClose("projeto-inexistente"),
  null,
  "Sem tarefa fechada a mediana deve ser null, não 0 — não medir é diferente de medir zero",
);

const fluxoVazio = projectMetricsService.issueFlow(metricsProject.id);
assert.deepEqual(
  fluxoVazio,
  { total: 0, promoted: 0, discarded: 0, open: 0 },
  "Projeto sem melhoria deve devolver fluxo zerado",
);

const i1 = projectIssueService.create({ projectId: metricsProject.id, title: "Vira tarefa", kind: "improvement" });
const i2 = projectIssueService.create({ projectId: metricsProject.id, title: "Descartada", kind: "bug" });
projectIssueService.create({ projectId: metricsProject.id, title: "Segue aberta", kind: "idea" });
projectIssueService.promoteToTask(i1.id);
projectIssueService.setStatus(i2.id, "wontfix");

const fluxo = projectMetricsService.issueFlow(metricsProject.id);
assert.equal(fluxo.total, 3, "Fluxo deve contar todas as melhorias do projeto");
assert.equal(fluxo.promoted, 1, "Melhoria promovida deve aparecer como aproveitada");
assert.equal(fluxo.discarded, 1, "Melhoria em wontfix deve aparecer como descartada");
assert.equal(fluxo.open, 1, "Melhoria ainda aberta deve aparecer como aberta");

const antigas = projectMetricsService.oldestOpenTasks(metricsProject.id, 5);
assert.equal(antigas.every((t) => !["done", "canceled"].includes(t.status)), true, "Lista de antigas só pode ter aberta");
assert.equal(
  antigas.every((t, i) => i === 0 || t.createdAt >= antigas[i - 1].createdAt),
  true,
  "Tarefas antigas devem sair da mais velha para a mais nova",
);

projectService.remove(metricsProject.id);

// ─── Alertas ──────────────────────────────────────────────────────────────────

// Estado montado de propósito: frente ativa, com tarefa aberta, sem próxima ação.
const alertProject = projectService.create({ name: "Projeto com alerta", kind: "other" });
const alertFront = frontService.create(alertProject.id, "Frente sem passo");
projectTaskService.create({ projectId: alertProject.id, title: "Tarefa aberta", frontId: alertFront.id });

const semPasso = projectAlertProvider.getAlerts().filter((a) => a.id === `projects-no-next-action-${alertFront.id}`);
assert.equal(semPasso.length, 1, "Frente ativa com tarefa aberta e sem próxima ação deve gerar alerta");
assert.equal(semPasso[0].severity, "warning", "Falta de próxima ação é a causa, não o sintoma — deve ser warning");
assert.equal(semPasso[0].moduleId, "projects", "Alerta deve declarar o módulo de origem");
assert.equal(
  semPasso[0].actionRoute,
  `/projetos/${alertProject.id}`,
  "Alerta deve levar direto ao projeto",
);

// Frente vazia não pode cobrar passo nenhum — não há o que apontar.
const frenteVazia = frontService.create(alertProject.id, "Frente vazia");
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.id === `projects-no-next-action-${frenteVazia.id}`),
  false,
  "Frente sem tarefa aberta NAO deve cobrar próxima ação",
);

// Definir a próxima ação desliga o alerta.
const passo = projectTaskService.create({ projectId: alertProject.id, title: "O passo", frontId: alertFront.id });
frontService.update(alertFront.id, { nextActionTaskId: passo.id });
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.id === `projects-no-next-action-${alertFront.id}`),
  false,
  "Definir a próxima ação deve desligar o alerta",
);

// Marco vencido.
const marcoVencido = projectMilestoneService.create({
  projectId: alertProject.id, title: "Entrega", targetDate: "2020-01-01",
});
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.id === `projects-overdue-milestone-${marcoVencido.id}`),
  true,
  "Marco vencido e não atingido deve gerar alerta",
);
projectMilestoneService.toggleReached(marcoVencido.id);
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.id === `projects-overdue-milestone-${marcoVencido.id}`),
  false,
  "Marco atingido não deve mais alertar",
);

// Projeto pausado nunca cobra: cobrança só faz sentido no que está ativo.
//
// O teste precisa de um alerta REAL para poder vê-lo sumir. Sem soltar a
// próxima ação antes, o projeto já não geraria alerta nenhum e a asserção
// passaria por vazio — foi assim que este teste nasceu, e uma mutação em
// getAlerts não o derrubava.
frontService.update(alertFront.id, { nextActionTaskId: undefined });
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.actionRoute === `/projetos/${alertProject.id}`),
  true,
  "Pré-condição: projeto ativo com frente sem próxima ação PRECISA alertar",
);
projectService.update(alertProject.id, { status: "paused" });
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.actionRoute === `/projetos/${alertProject.id}`),
  false,
  "Projeto pausado não deve gerar alerta nenhum",
);
projectService.update(alertProject.id, { status: "active" });
assert.equal(
  projectAlertProvider.getAlerts().some((a) => a.actionRoute === `/projetos/${alertProject.id}`),
  true,
  "Reativar o projeto deve trazer o alerta de volta",
);

// Ids estáveis: o mesmo estado precisa gerar exatamente os mesmos ids, senão a
// Home não consegue tratar alerta como o mesmo item entre renderizações.
const primeira = projectAlertProvider.getAlerts().map((a) => a.id).sort();
const segunda = projectAlertProvider.getAlerts().map((a) => a.id).sort();
assert.deepEqual(primeira, segunda, "getAlerts deve ser determinístico para o mesmo estado");
assert.equal(new Set(primeira).size, primeira.length, "Ids de alerta não podem repetir");

const registrySource = fs.readFileSync(
  path.join(projectRoot, "src", "core", "alerts", "alertRegistry.ts"), "utf8",
);
assert.equal(
  registrySource.includes("projectAlertProvider"),
  true,
  "Provider precisa estar registrado no alertRegistry — senão nada disso chega na Home",
);

projectService.remove(alertProject.id);

// ─── Cascade de exclusão ──────────────────────────────────────────────────────

projectMilestoneService.create({ projectId: personal.id, title: "Mudança feita" });
assert.equal(projectMilestoneService.listByProject(personal.id).length, 1, "Projeto deve ter marco antes de ser apagado");
assert.equal(eventsFor(personal.id).length > 0, true, "Projeto deve ter histórico antes de ser apagado");
projectService.remove(personal.id);
assert.equal(
  projectMilestoneService.listByProject(personal.id).length,
  0,
  "Cascade deve levar os marcos junto",
);
assert.equal(
  projectMilestoneService.listByProject(code.id).length > 0,
  true,
  "Cascade NAO pode apagar os marcos dos outros projetos",
);
assert.equal(projectService.getById(personal.id), null, "Projeto apagado não deve mais ser encontrado");
assert.equal(
  eventsFor(personal.id).length,
  0,
  "Cascade deve levar o histórico junto — evento órfão só ocupa espaço no snapshot do store",
);
assert.equal(
  eventsFor(code.id).length > 0,
  true,
  "Cascade NAO pode apagar o histórico dos outros projetos",
);

// ─── Chaves de storage ────────────────────────────────────────────────────────

assert.equal(projectKeys.events, "projects.events", "Chave do histórico deve ficar no namespace do módulo");
for (const [nome, chave] of Object.entries(projectKeys)) {
  assert.equal(chave.startsWith("projects."), true, `Chave "${nome}" deve ficar no namespace projects.`);
}

// projects-status.js espelha as chaves à mão; `events` fica FORA de propósito
// (o resumo não imprime histórico e o log é a maior coleção do módulo).
const statusSource = fs.readFileSync(path.join(projectRoot, "scripts", "projects-status.js"), "utf8");
for (const [nome, chave] of Object.entries(projectKeys)) {
  if (nome === "events") {
    assert.equal(
      statusSource.includes(`'${chave}'`),
      false,
      "projects-status.js não deve buscar projects.events — payload grande que o resumo não usa",
    );
    continue;
  }
  assert.equal(statusSource.includes(`'${chave}'`), true, `projects-status.js deve buscar ${chave}`);
}

// ─── Visualizador de arquivo ──────────────────────────────────────────────────

assert.equal(viewerKindFor({ fileName: "edital.pdf", mimeType: "application/pdf" }), "pdf", "PDF deve abrir como pdf");
assert.equal(viewerKindFor({ fileName: "EDITAL.PDF", mimeType: "" }), "pdf", "Extensão em maiúscula também conta");
assert.equal(viewerKindFor({ fileName: "x.pdf", mimeType: "application/octet-stream" }), "pdf", "Extensão vale quando o mime vem genérico do upload");

// O caso que a primeira versão errou: os anexos reais do Hub são Markdown, e
// nenhum deles ganhava botão de abrir porque só PDF era aceito.
assert.equal(
  viewerKindFor({ fileName: "jarvis-plano-de-autonomia.md", mimeType: "text/markdown" }),
  "markdown",
  "Markdown deve abrir renderizado — é o que de fato está anexado no Hub",
);
assert.equal(viewerKindFor({ fileName: "notas.markdown", mimeType: "" }), "markdown", "Extensão .markdown também conta");
assert.equal(viewerKindFor({ fileName: "saida.log", mimeType: "" }), "text", "Log abre como texto puro");
assert.equal(viewerKindFor({ fileName: "dados.csv", mimeType: "" }), "text", "CSV abre como texto puro");
assert.equal(viewerKindFor({ fileName: "qualquer", mimeType: "text/plain" }), "text", "mimeType text/* basta");

assert.equal(viewerKindFor({ fileName: "planilha.xlsx", mimeType: "application/vnd.ms-excel" }), null, "XLSX não tem visualizador");
assert.equal(viewerKindFor({ fileName: "doc.docx", mimeType: "" }), null, "DOCX ficou fora de propósito");
assert.equal(viewerKindFor({ fileName: "backup.zip", mimeType: "application/zip" }), null, "ZIP só pode ser baixado");

assert.equal(isViewableFile({ fileName: "a.md", mimeType: "" }), true, "isViewableFile deve seguir viewerKindFor");
assert.equal(isViewableFile({ fileName: "a.zip", mimeType: "" }), false, "isViewableFile deve seguir viewerKindFor");

const fileServiceSource = fs.readFileSync(modulePath("services", "projectFileService.ts"), "utf8");
assert.equal(
  fileServiceSource.includes("inline=1"),
  true,
  "inlineUrl precisa pedir ?inline=1 — sem isso o servidor manda Content-Disposition attachment e o visualizador não recebe bytes",
);

const serverSource = fs.readFileSync(path.join(projectRoot, "server", "index.js"), "utf8");
assert.equal(
  serverSource.includes("req.query.inline === '1'"),
  true,
  "O endpoint de download precisa aceitar ?inline=1",
);
assert.equal(
  /disposition\s*=\s*req\.query\.inline === '1' \? 'inline' : 'attachment'/.test(serverSource),
  true,
  "attachment tem de continuar sendo o padrão, para o botão baixar seguir baixando",
);
assert.equal(serverSource.includes("/pdf-info"), true, "Rota de metadados do PDF deve existir");
assert.equal(
  serverSource.includes("result.total"),
  true,
  "Contagem de páginas vem de result.total — esta versão do pdf-parse NAO expõe numpages",
);

const viewerSource = fs.readFileSync(modulePath("pages", "ProjectFileViewerPage.tsx"), "utf8");
// Sem os comentários: o arquivo CITA `<iframe` justamente para explicar por que
// não o usa, e uma busca crua acusaria o comentário como se fosse o código.
const viewerCode = viewerSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
assert.equal(
  viewerCode.includes("<iframe"),
  false,
  "O visualizador NAO pode usar iframe: o WebView do Android não embute leitor de PDF e daria tela branca no APK",
);
assert.equal(viewerSource.includes("createElement('canvas')"), true, "O visualizador deve renderizar em canvas via pdf.js");
assert.equal(
  viewerSource.includes("MarkdownView"),
  true,
  "Markdown deve reusar o MarkdownView do módulo Estudos, não um parser novo",
);
assert.equal(
  viewerSource.includes("pdf.worker.min.mjs?url"),
  true,
  "O worker do pdf.js deve ser empacotado como asset local (?url), nunca vir de CDN — o app precisa funcionar offline",
);

const filesPageSource = fs.readFileSync(modulePath("pages", "ProjectFilesPage.tsx"), "utf8");
assert.equal(filesPageSource.includes("isViewableFile"), true, "A lista de arquivos deve decidir o destino pelo tipo");
assert.equal(
  filesPageSource.includes("/arquivos/${file.id}"),
  true,
  "PDF na lista deve levar ao visualizador",
);

// ─── Navegação ────────────────────────────────────────────────────────────────

const detailSource = fs.readFileSync(modulePath("pages", "ProjectDetailPage.tsx"), "utf8");
assert.equal(
  fs.existsSync(modulePath("components", "projectsTabs.ts")),
  false,
  "projectsTabs.ts (tira de uma aba só) deve ter sido removido",
);
assert.equal(
  detailSource.includes("getProjectTabs(project)"),
  true,
  "Detalhe do projeto deve montar a tira de abas",
);

// Toda aba precisa de rota — aba apontando para rota inexistente cai no
// wildcard e joga o usuário de volta na lista, sem explicar por quê.
const routesSource = fs.readFileSync(modulePath("pages", "ProjectsRoutesPage.tsx"), "utf8");
const tabsSource = fs.readFileSync(modulePath("components", "projectTabs.ts"), "utf8");
for (const segmento of [...tabsSource.matchAll(/\$\{base\}\/([a-z]+)/g)].map((m) => m[1])) {
  assert.equal(
    routesSource.includes(`":projectId/${segmento}"`),
    true,
    `A aba "${segmento}" precisa de rota correspondente em ProjectsRoutesPage`,
  );
}

// O ModuleHeader esconde a seta sozinho quando a rota atual é uma das abas.
// Como agora TODAS as telas do projeto são abas, sem `back` explícito o
// projeto vira uma caixa sem saída para a lista.
for (const page of [
  "ProjectDetailPage.tsx", "ProjectIssuesPage.tsx", "ProjectDecisionsPage.tsx",
  "ProjectFilesPage.tsx", "ProjectExpansionsPage.tsx", "ProjectsActivityPage.tsx",
  "ProjectDashboardPage.tsx", "ProjectFileViewerPage.tsx",
]) {
  const source = fs.readFileSync(modulePath("pages", page), "utf8");
  assert.equal(source.includes("getProjectTabs(project)"), true, `${page} deve receber a tira de abas`);
  assert.equal(source.includes("back"), true, `${page} deve forçar a seta de voltar`);
}

console.log("Projects module check passed.");
