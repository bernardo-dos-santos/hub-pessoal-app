import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const calculationsPath = path.join(projectRoot, "src", "modules", "college", "utils", "collegeCalculations.ts");
const urgencyPath = path.join(projectRoot, "src", "modules", "college", "utils", "collegeUrgency.ts");
const listFiltersPath = path.join(projectRoot, "src", "modules", "college", "utils", "collegeListFilters.ts");
const materialFiltersPath = path.join(projectRoot, "src", "modules", "college", "utils", "collegeMaterialFilters.ts");
const materialAttachmentServicePath = path.join(projectRoot, "src", "modules", "college", "services", "materialAttachmentService.ts");
const studyPath = path.join(projectRoot, "src", "modules", "college", "utils", "collegeStudy.ts");
const quickCapturePath = path.join(projectRoot, "src", "modules", "college", "utils", "collegeQuickCapture.ts");
const periodPath = path.join(projectRoot, "src", "modules", "college", "utils", "collegePeriod.ts");
const moduleConfigPath = path.join(projectRoot, "src", "modules", "college", "module.config.ts");
const routesPath = path.join(projectRoot, "src", "modules", "college", "routes.ts");

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

const {
  calculateCollegeSummary,
  calculateSimpleGradeAverage,
  countLateTasks,
  countPendingTasks,
  getActiveSubjects,
  getEffectiveTaskStatus,
  listUpcomingAssessments,
} = require(calculationsPath);

const {
  filterCollegeUrgencyGroups,
  getCollegeUrgencyGroups,
} = require(urgencyPath);

const {
  filterCollegeAssessments,
  filterCollegeTasks,
  sortCollegeAssessments,
  sortCollegeTasks,
} = require(listFiltersPath);

const {
  filterCollegeMaterials,
  sortCollegeMaterials,
} = require(materialFiltersPath);

const {
  acceptedCollegeMaterialAttachmentTypes,
  collegeMaterialAttachmentMaxSizeBytes,
  formatAttachmentSize,
} = require(materialAttachmentServicePath);

const {
  getCollegeStudyOverview,
} = require(studyPath);

const {
  detectCollegeDate,
  detectCollegeItemType,
  getCollegeQuickCaptureDraftStatus,
  matchCollegeSubject,
  parseCollegeQuickCaptureText,
  summarizeCollegeQuickCaptureDrafts,
  validateCollegeQuickCaptureDraft,
} = require(quickCapturePath);

const {
  getCurrentSemester,
  isIsoDate,
  todayKey,
} = require(periodPath);

const createdAt = "2026-05-20T00:00:00.000Z";
const today = "2026-05-24";

function subject(overrides) {
  return {
    id: overrides.id,
    aliases: overrides.aliases,
    name: overrides.name ?? overrides.id,
    shortName: overrides.shortName,
    semester: overrides.semester ?? "2026.1",
    status: overrides.status ?? "active",
    createdAt,
    updatedAt: createdAt,
  };
}

function task(overrides) {
  return {
    id: overrides.id,
    subjectId: overrides.subjectId ?? "alg",
    title: overrides.title ?? overrides.id,
    dueDate: overrides.dueDate,
    status: overrides.status ?? "pending",
    priority: overrides.priority ?? "medium",
    source: overrides.source,
    createdAt,
    updatedAt: createdAt,
  };
}

function assessment(overrides) {
  return {
    id: overrides.id,
    subjectId: overrides.subjectId ?? "alg",
    title: overrides.title ?? overrides.id,
    type: overrides.type ?? "exam",
    date: overrides.date,
    status: overrides.status ?? "scheduled",
    source: overrides.source,
    createdAt,
    updatedAt: createdAt,
  };
}

function grade(overrides) {
  return {
    id: overrides.id,
    subjectId: overrides.subjectId ?? "alg",
    title: overrides.title ?? overrides.id,
    value: overrides.value,
    maxValue: overrides.maxValue,
    weight: overrides.weight,
    createdAt,
    updatedAt: createdAt,
  };
}

function material(overrides) {
  return {
    id: overrides.id,
    subjectId: overrides.subjectId,
    title: overrides.title ?? overrides.id,
    type: overrides.type ?? "note",
    url: overrides.url,
    description: overrides.description,
    tags: overrides.tags,
    source: overrides.source,
    createdAt: overrides.createdAt ?? createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  };
}

const subjects = [
  subject({ id: "alg", name: "Algoritmos" }),
  subject({ id: "calc", name: "Calculo", status: "archived" }),
  subject({ id: "bd", name: "Banco de Dados", status: "completed" }),
];

const quickCaptureSubjects = [
  subject({ id: "poo", name: "Programacao Orientada a Objetos", shortName: "POO", aliases: ["Prog Orientada"] }),
  subject({ id: "calc", name: "Calculo", aliases: ["Calc"] }),
  subject({ id: "bd", name: "Banco de Dados", aliases: ["BD", "Banco"] }),
  subject({ id: "eng-soft", name: "Engenharia de Software", aliases: ["ES", "Eng Software"] }),
  subject({ id: "redes", name: "Redes de Computadores", aliases: ["Redes"] }),
];

const tasks = [
  task({ id: "pending", dueDate: "2026-05-30", status: "pending" }),
  task({ id: "progress", dueDate: "2026-05-25", status: "in_progress" }),
  task({ id: "late", dueDate: "2026-05-10", status: "pending" }),
  task({ id: "done", dueDate: "2026-05-12", status: "done" }),
  task({ id: "canceled", dueDate: "2026-05-01", status: "canceled" }),
];

const assessments = [
  assessment({ id: "p2", date: "2026-05-28" }),
  assessment({ id: "p1", date: "2026-05-26" }),
  assessment({ id: "past", date: "2026-05-01" }),
  assessment({ id: "done", date: "2026-05-27", status: "completed" }),
];

const urgencyTasks = [
  task({ id: "task-overdue", dueDate: "2026-05-20", status: "pending", priority: "low" }),
  task({ id: "task-today", dueDate: today, status: "in_progress", priority: "medium" }),
  task({ id: "task-week", dueDate: "2026-05-29", status: "pending", priority: "high" }),
  task({ id: "task-upcoming", dueDate: "2026-06-10", status: "pending", priority: "medium" }),
  task({ id: "task-done", dueDate: today, status: "done", priority: "high" }),
];

const urgencyAssessments = [
  assessment({ id: "assessment-overdue", date: "2026-05-22" }),
  assessment({ id: "assessment-today", date: today }),
  assessment({ id: "assessment-week", date: "2026-05-31" }),
  assessment({ id: "assessment-upcoming", date: "2026-06-20" }),
  assessment({ id: "assessment-completed", date: today, status: "completed" }),
];

const listTasks = [
  task({ id: "done-list", dueDate: "2026-05-20", status: "done", priority: "high" }),
  task({ id: "future-list", dueDate: "2026-05-30", status: "pending", priority: "medium" }),
  task({ id: "late-list", dueDate: "2026-05-19", status: "pending", priority: "low" }),
  task({ id: "today-list", dueDate: today, status: "pending", priority: "medium", source: "quick_text" }),
  task({ id: "canceled-list", dueDate: "2026-05-18", status: "canceled", priority: "high" }),
  task({ id: "other-subject-list", subjectId: "bd", dueDate: "2026-05-25", status: "pending", priority: "high" }),
];

const listAssessments = [
  assessment({ id: "completed-list", date: "2026-05-20", status: "completed" }),
  assessment({ id: "future-list", date: "2026-05-30", status: "scheduled" }),
  assessment({ id: "late-list", date: "2026-05-19", status: "scheduled", source: "quick_text" }),
  assessment({ id: "today-list", date: today, status: "scheduled" }),
  assessment({ id: "missed-list", date: "2026-05-18", status: "missed" }),
  assessment({ id: "other-subject-list", subjectId: "bd", date: "2026-05-25", status: "scheduled" }),
];

const listMaterials = [
  material({ id: "old-note", subjectId: "alg", title: "Anotacao antiga", type: "note", tags: ["resumo"], updatedAt: "2026-05-19T00:00:00.000Z" }),
  material({ id: "calc-list", subjectId: "calc", title: "Lista 01 de Calculo", type: "exercise_list", tags: ["lista", "prova"], updatedAt: "2026-05-21T00:00:00.000Z" }),
  material({ id: "bd-slide", subjectId: "bd", title: "Slide de Introducao a Banco de Dados", type: "slide", description: "modelo relacional", updatedAt: "2026-05-22T00:00:00.000Z" }),
  material({ id: "general-link", title: "Link do Moodle", type: "link", url: "https://moodle.example", tags: ["moodle"], updatedAt: "2026-05-23T00:00:00.000Z" }),
];

assert.equal(getEffectiveTaskStatus(tasks[2], today), "late", "Tarefa pendente vencida deve virar atrasada");
assert.equal(countPendingTasks(tasks, today), 2, "Pendentes devem contar pending e in_progress ainda no prazo");
assert.equal(countLateTasks(tasks, today), 1, "Atrasadas devem detectar pending vencida");
assert.equal(getActiveSubjects(subjects).length, 1, "Resumo ativo deve ignorar disciplinas arquivadas e concluidas");

const upcomingAssessments = listUpcomingAssessments(assessments, today, 5);
assert.deepEqual(upcomingAssessments.map((item) => item.id), ["p1", "p2"], "Proximas avaliacoes devem excluir passadas e concluidas");

assert.equal(calculateSimpleGradeAverage([]), null, "Media vazia deve ser nula");
assert.equal(calculateSimpleGradeAverage([grade({ id: "g1", value: 8 }), grade({ id: "g2", value: 10 })]), 9, "Media simples deve ser aritmetica");
assert.equal(
  calculateSimpleGradeAverage([grade({ id: "g1", value: 6, weight: 1 }), grade({ id: "g2", value: 10, weight: 3 })]),
  9,
  "Media ponderada deve usar peso quando houver",
);

const summary = calculateCollegeSummary({ assessments, subjects, tasks, today, currentSemester: "2026.1" });
assert.equal(summary.activeSubjects, 1, "Resumo deve contar apenas disciplinas ativas");
assert.equal(summary.pendingTasks, 2, "Resumo deve contar tarefas pendentes abertas");
assert.equal(summary.lateTasks, 1, "Resumo deve contar tarefas atrasadas");
assert.equal(summary.completedTasks, 1, "Resumo deve contar tarefas concluidas");
assert.equal(summary.upcomingAssessments, 2, "Resumo deve contar avaliacoes futuras agendadas");
assert.equal(summary.currentSemester, "2026.1", "Resumo deve preservar semestre atual");

const urgencyGroups = getCollegeUrgencyGroups({
  assessments: urgencyAssessments,
  referenceDate: today,
  tasks: urgencyTasks,
});
assert.deepEqual(
  urgencyGroups.overdue.map((item) => item.id),
  ["task-task-overdue", "assessment-assessment-overdue"],
  "Grupo Atrasado deve juntar tarefas vencidas e avaliacoes agendadas passadas",
);
assert.deepEqual(
  urgencyGroups.today.map((item) => item.id),
  ["assessment-assessment-today", "task-task-today"],
  "Grupo Hoje deve juntar tarefas e avaliacoes do dia",
);
assert.deepEqual(
  urgencyGroups.thisWeek.map((item) => item.id),
  ["task-task-week", "assessment-assessment-week"],
  "Grupo Esta semana deve usar a janela dos proximos 7 dias",
);
assert.deepEqual(
  urgencyGroups.upcoming.map((item) => item.id),
  ["task-task-upcoming", "assessment-assessment-upcoming"],
  "Grupo Em breve deve receber itens depois da janela semanal",
);
assert.equal(
  [...urgencyGroups.overdue, ...urgencyGroups.today, ...urgencyGroups.thisWeek, ...urgencyGroups.upcoming]
    .some((item) => item.sourceId === "task-done" || item.sourceId === "assessment-completed"),
  false,
  "Urgencia deve ignorar tarefas concluidas e avaliacoes realizadas",
);

const taskOnlyUrgencyGroups = filterCollegeUrgencyGroups(urgencyGroups, { type: "task" });
assert.deepEqual(
  [...taskOnlyUrgencyGroups.overdue, ...taskOnlyUrgencyGroups.today, ...taskOnlyUrgencyGroups.thisWeek, ...taskOnlyUrgencyGroups.upcoming]
    .map((item) => item.kind),
  ["task", "task", "task", "task"],
  "Filtro por tipo task deve manter apenas tarefas",
);

const assessmentOnlyUrgencyGroups = filterCollegeUrgencyGroups(urgencyGroups, { type: "assessment" });
assert.deepEqual(
  [...assessmentOnlyUrgencyGroups.overdue, ...assessmentOnlyUrgencyGroups.today, ...assessmentOnlyUrgencyGroups.thisWeek, ...assessmentOnlyUrgencyGroups.upcoming]
    .map((item) => item.kind),
  ["assessment", "assessment", "assessment", "assessment"],
  "Filtro por tipo assessment deve manter apenas avaliacoes",
);

const subjectFilteredUrgencyGroups = filterCollegeUrgencyGroups(urgencyGroups, { type: "all", subjectId: "alg" });
assert.equal(
  [...subjectFilteredUrgencyGroups.overdue, ...subjectFilteredUrgencyGroups.today, ...subjectFilteredUrgencyGroups.thisWeek, ...subjectFilteredUrgencyGroups.upcoming]
    .every((item) => item.subjectId === "alg"),
  true,
  "Filtro por disciplina deve manter apenas itens da disciplina escolhida",
);
const emptySubjectFilteredUrgencyGroups = filterCollegeUrgencyGroups(urgencyGroups, { type: "all", subjectId: "subject-without-items" });
assert.equal(
  [...emptySubjectFilteredUrgencyGroups.overdue, ...emptySubjectFilteredUrgencyGroups.today, ...emptySubjectFilteredUrgencyGroups.thisWeek, ...emptySubjectFilteredUrgencyGroups.upcoming].length,
  0,
  "Filtro por disciplina sem itens deve retornar grupos vazios",
);

assert.deepEqual(
  sortCollegeTasks(listTasks, today).map((item) => item.id),
  ["late-list", "today-list", "other-subject-list", "future-list", "canceled-list", "done-list"],
  "Tarefas devem ordenar atrasadas abertas, hoje, proximas e finalizadas no final",
);
assert.deepEqual(
  filterCollegeTasks(listTasks, { status: "open", subjectId: "alg" }, today).map((item) => item.id),
  ["future-list", "late-list", "today-list"],
  "Filtro de tarefas abertas deve manter pending/in_progress/late da disciplina",
);
assert.deepEqual(
  filterCollegeTasks(listTasks, { status: "late" }, today).map((item) => item.id),
  ["late-list"],
  "Filtro de tarefas atrasadas deve usar status efetivo",
);
assert.deepEqual(
  filterCollegeTasks(listTasks, { status: "done" }, today).map((item) => item.id),
  ["done-list"],
  "Filtro de tarefas concluidas deve manter somente done",
);
assert.deepEqual(
  filterCollegeTasks(listTasks, { source: "quick_text", status: "all" }, today).map((item) => item.id),
  ["today-list"],
  "Filtro de tarefas por origem quick_text deve manter apenas captura rapida",
);
assert.equal(
  filterCollegeTasks(listTasks, { source: "manual", status: "all" }, today).some((item) => item.source === "quick_text"),
  false,
  "Filtro de tarefas manuais deve excluir captura rapida",
);

assert.deepEqual(
  sortCollegeAssessments(listAssessments, today).map((item) => item.id),
  ["late-list", "today-list", "other-subject-list", "future-list", "missed-list", "completed-list"],
  "Avaliacoes devem ordenar agendadas atrasadas, hoje, proximas e finalizadas no final",
);
assert.deepEqual(
  filterCollegeAssessments(listAssessments, { status: "scheduled", subjectId: "alg" }).map((item) => item.id),
  ["future-list", "late-list", "today-list"],
  "Filtro de avaliacoes agendadas deve respeitar disciplina",
);
assert.deepEqual(
  filterCollegeAssessments(listAssessments, { status: "missed" }).map((item) => item.id),
  ["missed-list"],
  "Filtro de avaliacoes perdidas deve manter somente missed",
);
assert.deepEqual(
  filterCollegeAssessments(listAssessments, { source: "quick_text", status: "all" }).map((item) => item.id),
  ["late-list"],
  "Filtro de avaliacoes por origem quick_text deve manter apenas captura rapida",
);
assert.equal(
  filterCollegeAssessments(listAssessments, { source: "manual", status: "all" }).some((item) => item.source === "quick_text"),
  false,
  "Filtro de avaliacoes manuais deve excluir captura rapida",
);

assert.deepEqual(
  sortCollegeMaterials(listMaterials).map((item) => item.id),
  ["general-link", "bd-slide", "calc-list", "old-note"],
  "Materiais devem ordenar por atualizacao mais recente",
);
assert.deepEqual(
  filterCollegeMaterials(listMaterials, { subjectId: "calc", type: "exercise_list" }).map((item) => item.id),
  ["calc-list"],
  "Filtro de materiais deve combinar disciplina e tipo",
);
assert.deepEqual(
  filterCollegeMaterials(listMaterials, { query: "moodle", subjectId: "general" }).map((item) => item.id),
  ["general-link"],
  "Filtro de materiais deve buscar em tags/url e aceitar materiais gerais",
);
assert.deepEqual(
  filterCollegeMaterials(listMaterials, { query: "relacional" }).map((item) => item.id),
  ["bd-slide"],
  "Busca de materiais deve encontrar texto em descricao",
);
assert.equal(formatAttachmentSize(20 * 1024 * 1024), "20,0 MB", "Formatador de anexo deve exibir MB");
assert.equal(collegeMaterialAttachmentMaxSizeBytes, 20 * 1024 * 1024, "Limite inicial de anexos deve ser 20MB");
assert.equal(acceptedCollegeMaterialAttachmentTypes.includes("application/pdf"), true, "Anexos devem aceitar PDF");
assert.equal(acceptedCollegeMaterialAttachmentTypes.includes("image/png"), true, "Anexos devem aceitar imagens simples");

const studyOverview = getCollegeStudyOverview({
  assessments: [
    assessment({ id: "study-assessment", date: "2026-05-27", subjectId: "calc" }),
    assessment({ id: "other-assessment", date: "2026-05-27", subjectId: "bd" }),
  ],
  grades: [
    grade({ id: "study-grade-1", subjectId: "calc", value: 8 }),
    grade({ id: "study-grade-2", subjectId: "calc", value: 10 }),
  ],
  materials: listMaterials,
  subjectId: "calc",
  subjects: quickCaptureSubjects,
  tasks: [
    task({ id: "study-task", dueDate: "2026-05-26", subjectId: "calc", status: "pending" }),
    task({ id: "other-task", dueDate: "2026-05-26", subjectId: "bd", status: "pending" }),
  ],
  today,
});
assert.equal(studyOverview.subject.id, "calc", "Estudo deve localizar disciplina selecionada");
assert.deepEqual(studyOverview.materials.map((item) => item.id), ["calc-list"], "Estudo deve listar materiais da disciplina");
assert.deepEqual(studyOverview.openTasks.map((item) => item.id), ["study-task"], "Estudo deve listar tarefas abertas da disciplina");
assert.deepEqual(studyOverview.upcomingAssessments.map((item) => item.id), ["study-assessment"], "Estudo deve listar avaliacoes proximas da disciplina");
assert.equal(studyOverview.average, 9, "Estudo deve calcular media simples da disciplina");
assert.deepEqual(studyOverview.commonTags, ["lista", "prova"], "Estudo deve listar tags comuns dos materiais");
assert.equal(
  studyOverview.nextSteps.some((step) => step.id === "review-for-assessment" && step.id !== "add-materials"),
  true,
  "Estudo deve sugerir revisao quando houver avaliacao proxima",
);
assert.equal(
  studyOverview.nextSteps.some((step) => step.id === "exercise-lists"),
  true,
  "Estudo deve sugerir resolver listas quando houver material exercise_list",
);

assert.equal(detectCollegeItemType("Calculo prova AV2 dia 10/06 peso 4"), "assessment", "Prova deve virar avaliacao");
assert.equal(detectCollegeItemType("POO - trabalho de API para 28/05"), "task", "Trabalho deve virar tarefa");
assert.equal(detectCollegeDate("Banco de Dados lista 3 entregar sexta", today), "2026-05-29", "Dia da semana deve virar proxima data");
assert.equal(detectCollegeDate("Redes relatorio ate amanha", today), "2026-05-25", "Amanha deve virar referenceDate + 1");
assert.equal(detectCollegeDate("POO tarefa hoje", today), today, "Hoje deve virar referenceDate");
assert.equal(detectCollegeDate("Banco atividade postar no Moodle semana que vem", today), "2026-05-31", "Semana que vem deve virar referenceDate + 7");
assert.equal(matchCollegeSubject("POO - trabalho de API", quickCaptureSubjects)?.id, "poo", "Parser deve identificar disciplina por apelido");
assert.equal(matchCollegeSubject("BD lista 3 sexta", quickCaptureSubjects)?.id, "bd", "Parser deve identificar disciplina por alias curto");
assert.equal(matchCollegeSubject("Calc prova AV2 dia 10/06", quickCaptureSubjects)?.id, "calc", "Parser deve identificar disciplina por alias textual");
assert.equal(matchCollegeSubject("Eng Software seminario proxima sexta", quickCaptureSubjects)?.id, "eng-soft", "Parser deve identificar disciplina por alias composto");
assert.equal(detectCollegeItemType("recuperacao de Calculo dia 10/06"), "assessment", "Recuperacao deve virar avaliacao");
assert.equal(detectCollegeItemType("postar no Moodle semana que vem"), "task", "Moodle deve virar tarefa quando houver duvida");

const quickCaptureResult = parseCollegeQuickCaptureText({
  referenceDate: today,
  subjects: quickCaptureSubjects,
  text: [
    "POO - trabalho de API para 28/05",
    "Calc prova AV2 dia 10/06 peso 4",
    "BD lista 3 entregar sexta",
    "Redes relatorio em grupo ate amanha",
    "ES seminario proxima sexta",
    "Banco atividade postar no Moodle semana que vem",
    "Entregar relatorio final ate 15/06",
  ].join("\n"),
});
assert.equal(quickCaptureResult.drafts.length, 7, "Captura rapida deve gerar um rascunho por linha util");
assert.equal(quickCaptureResult.drafts[0].type, "task", "Trabalho deve ser rascunho de tarefa");
assert.equal(quickCaptureResult.drafts[0].subjectId, "poo", "Rascunho deve carregar disciplina detectada");
assert.equal(quickCaptureResult.drafts[0].date, "2026-05-28", "Rascunho deve carregar prazo detectado");
assert.equal(quickCaptureResult.drafts[1].type, "assessment", "Prova deve ser rascunho de avaliacao");
assert.equal(quickCaptureResult.drafts[1].assessmentType, "exam", "Prova deve virar tipo exam");
assert.equal(quickCaptureResult.drafts[1].weight, 4, "Peso deve ser detectado");
assert.equal(quickCaptureResult.drafts[2].date, "2026-05-29", "Sexta deve virar data proxima");
assert.equal(quickCaptureResult.drafts[3].subjectId, "redes", "Alias Redes deve detectar disciplina");
assert.equal(quickCaptureResult.drafts[3].date, "2026-05-25", "Ate amanha deve detectar prazo relativo");
assert.equal(quickCaptureResult.drafts[4].type, "assessment", "Seminario deve virar avaliacao");
assert.equal(quickCaptureResult.drafts[4].subjectId, "eng-soft", "Alias ES deve detectar Engenharia de Software");
assert.equal(quickCaptureResult.drafts[5].date, "2026-05-31", "Semana que vem deve detectar data relativa simples");
assert.equal(quickCaptureResult.drafts[5].notes.includes("postar no Moodle"), true, "Observacoes devem preservar texto original util");
assert.equal(quickCaptureResult.drafts[6].incomplete, true, "Linha sem disciplina deve ficar incompleta");
assert.equal(quickCaptureResult.drafts[6].source, "quick_text", "Origem deve ser quick_text");
assert.deepEqual(
  validateCollegeQuickCaptureDraft({ ...quickCaptureResult.drafts[6], subjectId: "bd" }),
  { incomplete: false, warnings: [] },
  "Rascunho incompleto deve ficar pronto apos correcao manual",
);
assert.equal(
  getCollegeQuickCaptureDraftStatus({ ...quickCaptureResult.drafts[0], ignored: true }),
  "ignored",
  "Rascunho ignorado deve ter status proprio e nao entrar no salvamento seletivo",
);
assert.deepEqual(
  summarizeCollegeQuickCaptureDrafts([
    quickCaptureResult.drafts[0],
    quickCaptureResult.drafts[1],
    quickCaptureResult.drafts[6],
    { ...quickCaptureResult.drafts[2], ignored: true },
  ]),
  { assessments: 1, ignored: 1, incomplete: 1, ready: 2, tasks: 1, total: 4 },
  "Resumo da captura deve contar prontos, incompletos, ignorados, tarefas e avaliacoes",
);

assert.equal(getCurrentSemester(new Date("2026-05-24T12:00:00.000Z")), "2026.1", "Primeiro semestre deve usar sufixo .1");
assert.equal(getCurrentSemester(new Date("2026-08-01T12:00:00.000Z")), "2026.2", "Segundo semestre deve usar sufixo .2");
assert.equal(isIsoDate(todayKey(new Date("2026-05-24T12:00:00.000Z"))), true, "todayKey deve gerar data ISO curta");

const moduleConfigSource = fs.readFileSync(moduleConfigPath, "utf8");
const routesSource = fs.readFileSync(routesPath, "utf8");
assert.equal(moduleConfigSource.includes("status: 'active'"), true, "Faculdade deve estar ativa");
assert.equal(moduleConfigSource.includes("showInHome: true"), true, "Faculdade deve aparecer na home");
assert.equal(moduleConfigSource.includes("supportsAiSummary: false"), true, "Faculdade nao deve ativar IA");
assert.equal(moduleConfigSource.includes("supportsBackup: true"), true, "Faculdade deve declarar suporte ao backup local");
assert.equal(routesSource.includes("path: 'faculdade/*'"), true, "Rotas de Faculdade devem aceitar subrotas");
assert.equal(fs.readFileSync(path.join(projectRoot, "src", "modules", "college", "pages", "CollegeRoutesPage.tsx"), "utf8").includes('path="captura"'), true, "Rotas de Faculdade devem expor captura rapida");
assert.equal(fs.readFileSync(path.join(projectRoot, "src", "modules", "college", "pages", "CollegeRoutesPage.tsx"), "utf8").includes('path="estudo"'), true, "Rotas de Faculdade devem expor estudo por disciplina");

console.log("College module check passed.");
