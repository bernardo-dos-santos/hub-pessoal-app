import { assessmentService } from './assessmentService';
import { gradeService } from './gradeService';
import { materialService } from './materialService';
import { subjectService } from './subjectService';
import { taskService } from './taskService';
import { ALERT_RECENCY_DAYS, alertService, buildSigaaHash } from './alertService';
import { defaultSubjectColors } from '../data/defaultCollegeData';
import { isSubjectDeleted } from './sigaaTombstones';
import { type Material } from '../types/material';

// --- Tipos do arquivo exportado pelo script sigaa-sync.js ---

export type SigaaExportExam = {
  description: string;
  date: string | null;
};

export type SigaaExportFile = {
  id: string;
  title: string | null;
  description: string | null;
};

export type SigaaExportSubGrade = {
  code: string;
  name: string;
  value: number | null;
  weight?: number;
  maxValue?: number;
};

export type SigaaExportGrade = {
  name: string;
  value: number | null;
  type: string;
  isRecovery?: boolean;
  subGrades: SigaaExportSubGrade[];
};

export type SigaaExportTask = {
  description: string;
  date: string | null;
};

export type SigaaExportNews = {
  title: string;
  date: string | null;
  content?: string | null;
};

export type SigaaParsedPlanAssessment = {
  label: string;           // ex: "AV1", "Trabalho 1"
  resultsKey: string;      // coluna do SIGAA: "Resultado Parcial 1"
  weight: number;          // 0.0–1.0
  unitNumbers?: number[];  // unidades cobertas
  topics?: string[];       // tópicos cobertos
};

export type SigaaParsedPlan = {
  passingGrade: number;       // nota mínima (IFSC = 6)
  minAttendance: number;      // frequência mínima em % (IFSC = 75)
  finalFormula?: string;      // ex: "(AV1+AV2+AV3)/3"
  assessments: SigaaParsedPlanAssessment[];
  recovery?: {
    policy: 'replaces' | 'averages';
    maxGrade: number;
    coversAll: boolean;
  };
};

export type SigaaExportCourse = {
  id: string;
  title: string;
  code: string;
  period: string;
  schedule: string;
  exams: SigaaExportExam[];
  tasks: SigaaExportTask[];
  files: SigaaExportFile[];
  grades: SigaaExportGrade[];
  news?: SigaaExportNews[];
  planText?: string;
  parsedPlan?: SigaaParsedPlan;
  absences?: number;
  totalAllowedAbsences?: number;
};

export type SigaaExport = {
  exportedAt: string;
  studentName: string;
  period: string;
  courses: SigaaExportCourse[];
};

export type SigaaImportResult = {
  subjects: number;
  assessments: number;
  tasks: number;
  materials: number;
  grades: number;
  alerts: number;
  skipped: number;
};

export function isSigaaExport(data: unknown): data is SigaaExport {
  return (
    typeof data === 'object' &&
    data !== null &&
    'exportedAt' in data &&
    'courses' in data &&
    Array.isArray((data as SigaaExport).courses)
  );
}

function logSigaaImport(message: string, details?: unknown): void {
  // Centraliza o prefixo dos logs para facilitar o filtro no console quando a
  // gente estiver investigando importacoes parciais ou inconsistentes.
  if (details === undefined) {
    console.info(`[SIGAA import] ${message}`);
    return;
  }

  console.info(`[SIGAA import] ${message}`, details);
}

function resolveSigaaMaterialType(file: SigaaExportFile): Material['type'] {
  // Mantém o tipo coerente já na importação: PDFs entram como `pdf_reference`,
  // outros arquivos continuam `file_reference` e não são tratados como PDF pela IA.
  const signature = `${file.title ?? ''} ${file.description ?? ''}`;
  return /\.pdf(\b|$)/i.test(signature) ? 'pdf_reference' : 'file_reference';
}

export function importSigaaData(data: SigaaExport): SigaaImportResult {
  const result: SigaaImportResult = { subjects: 0, assessments: 0, tasks: 0, materials: 0, grades: 0, alerts: 0, skipped: 0 };
  const recencyCutoff = new Date();
  recencyCutoff.setDate(recencyCutoff.getDate() - ALERT_RECENCY_DAYS);
  const existingSubjects = subjectService.listSubjects();
  const existingAssessments = assessmentService.listAssessments();
  const existingTasks = taskService.listTasks();
  const existingMaterials = materialService.listMaterials();
  const existingGrades = gradeService.listGrades();

  data.courses.forEach((course, index) => {
    const beforeCourse = { ...result };
    logSigaaImport(`Iniciando disciplina "${course.title}"`, {
      files: course.files.length,
      exams: course.exams.length,
      tasks: course.tasks.length,
      grades: course.grades.length,
      news: course.news?.length ?? 0,
    });

    // --- Disciplina ---
    let subject = existingSubjects.find(
      (s) => s.name.toLowerCase() === course.title.toLowerCase() ||
             (course.code.length > 0 && s.shortName?.toLowerCase() === course.code.toLowerCase()),
    );

    // Apagada de propósito: não recria, e nada dela entra junto (tarefas,
    // avaliações, materiais). Sem esta checagem, a importação tratava exclusão
    // como perda de dado e "consertava" trazendo tudo de volta no sync
    // seguinte.
    if (!subject && isSubjectDeleted(course.title)) {
      result.skipped++;
      logSigaaImport(`Disciplina "${course.title}" ignorada: excluída de propósito`, {});
      return;
    }

    if (!subject) {
      subject = subjectService.createSubject({
        name: course.title,
        shortName: course.code || undefined,
        semester: course.period || undefined,
        color: defaultSubjectColors[index % defaultSubjectColors.length],
        aliases: course.code ? [course.code] : [],
        status: 'active',
      });
      result.subjects++;
    }

    // --- Avaliações ---
    course.exams.forEach((exam) => {
      const examDate = exam.date ? exam.date.split('T')[0] : null;
      if (!examDate) { result.skipped++; return; }

      const alreadyExists = existingAssessments.some(
        (a) => a.subjectId === subject!.id &&
               a.title.toLowerCase() === exam.description.toLowerCase(),
      );
      if (alreadyExists) { result.skipped++; return; }

      assessmentService.createAssessment({
        subjectId: subject!.id,
        title: exam.description,
        type: 'exam',
        date: examDate,
        status: exam.date && new Date(exam.date) < new Date() ? 'completed' : 'scheduled',
      });
      result.assessments++;
    });

    // --- Tarefas ---
    (course.tasks ?? []).forEach((task) => {
      const alreadyExists = existingTasks.some(
        (t) => t.subjectId === subject!.id &&
               t.title.toLowerCase() === task.description.toLowerCase(),
      );
      if (alreadyExists) { result.skipped++; return; }

      taskService.createTask({
        subjectId: subject!.id,
        title: task.description,
        dueDate: task.date ?? new Date().toISOString().split('T')[0],
      });
      result.tasks++;
    });

    // --- Materiais (arquivos do SIGAA) ---
    course.files.forEach((file) => {
      const title = file.title ?? `Arquivo ${file.id}`;
      const sigaaUrl = `sigaa://${file.id}`;
      const materialType = resolveSigaaMaterialType(file);

      logSigaaImport(`Material "${title}" em "${course.title}"`, {
        fileId: file.id,
        sigaaUrl,
        materialType,
      });

      const existingMaterial = existingMaterials.find(
        (m) => m.subjectId === subject!.id && (
          m.url === sigaaUrl ||
          m.title.toLowerCase() === title.toLowerCase()
        ),
      );
      if (existingMaterial) {
        // Corrige imports antigos em que o SIGAA gerou urls repetidas. Se o match veio
        // pelo título, atualizamos a referência externa e o tipo sem recriar o material.
        const shouldRefresh =
          existingMaterial.url !== sigaaUrl ||
          existingMaterial.description !== (file.description ?? undefined) ||
          existingMaterial.type !== materialType;

        if (shouldRefresh) {
          materialService.updateMaterial(existingMaterial.id, {
            url: sigaaUrl,
            description: file.description ?? undefined,
            type: materialType,
          });
          logSigaaImport(`Material atualizado "${title}" em "${course.title}"`, {
            materialId: existingMaterial.id,
          });
        }

        result.skipped++;
        return;
      }

      materialService.createMaterial({
        subjectId: subject!.id,
        title,
        type: materialType,
        url: sigaaUrl,
        description: file.description ?? undefined,
        tags: ['sigaa'],
        source: 'sigaa' as never,
      });
      result.materials++;
      logSigaaImport(`Material criado "${title}" em "${course.title}"`, {
        sigaaUrl,
      });
    });

    // Atualiza parsedPlan e attendance na disciplina quando o sync traz dados novos
    if (subject) {
      const updates: Parameters<typeof subjectService.updateSubject>[1] = {};
      if (course.parsedPlan && !(subject as { parsedPlan?: unknown }).parsedPlan) {
        updates.parsedPlan = course.parsedPlan;
      }
      if (course.absences !== undefined) {
        updates.attendance = {
          absences: course.absences,
          totalAllowed: course.totalAllowedAbsences ?? null,
        };
      }
      if (Object.keys(updates).length > 0) {
        subjectService.updateSubject(subject.id, updates);
      }
    }

    // --- Notas ---
    const plan = course.parsedPlan;
    course.grades.forEach((gradeGroup) => {
      // Encontra o assessment correspondente no parsedPlan para enriquecer o título e peso
      const planEntry = plan?.assessments.find(
        (a) => a.resultsKey.toLowerCase() === gradeGroup.name.toLowerCase(),
      );
      const isRecovery = gradeGroup.isRecovery ?? false;

      // Sub-notas (ex: A1, A2 dentro de Resultado Parcial 1)
      gradeGroup.subGrades.forEach((sub) => {
        if (sub.value === null) return;
        const sigaaColumn = `${gradeGroup.name} — ${sub.name}`;
        // Tenta match pelo sigaaColumn estável; fallback pelo título antigo
        const alreadyExists = existingGrades.some(
          (g) => g.subjectId === subject!.id && (
            g.sigaaColumn?.toLowerCase() === sigaaColumn.toLowerCase() ||
            g.title.toLowerCase() === sigaaColumn.toLowerCase()
          ),
        );
        if (alreadyExists) { result.skipped++; return; }

        const label = planEntry ? `${planEntry.label} — ${sub.name}` : sigaaColumn;
        gradeService.createGrade({
          subjectId: subject!.id,
          title: label,
          sigaaColumn,
          value: sub.value,
          maxValue: 10,
          weight: planEntry?.weight,
          isRecovery,
          topics: planEntry?.topics,
        });
        result.grades++;
      });

      // Nota simples (sem sub-notas)
      if (gradeGroup.subGrades.length === 0 && gradeGroup.value !== null) {
        const sigaaColumn = gradeGroup.name;
        const alreadyExists = existingGrades.find(
          (g) => g.subjectId === subject!.id && (
            g.sigaaColumn?.toLowerCase() === sigaaColumn.toLowerCase() ||
            g.title.toLowerCase() === sigaaColumn.toLowerCase() ||
            (planEntry && g.title.toLowerCase() === planEntry.label.toLowerCase())
          ),
        );

        if (alreadyExists) {
          // Atualiza valor se mudou (ex: nota foi lançada depois do primeiro sync)
          if (alreadyExists.value !== gradeGroup.value) {
            gradeService.updateGrade(alreadyExists.id, {
              value: gradeGroup.value!,
              weight: planEntry?.weight ?? alreadyExists.weight,
              topics: planEntry?.topics ?? alreadyExists.topics,
            });
            result.grades++;
          } else {
            result.skipped++;
          }
          return;
        }

        const label = planEntry?.label ?? (isRecovery ? `Rec. ${sigaaColumn}` : sigaaColumn);
        gradeService.createGrade({
          subjectId: subject!.id,
          title: label,
          sigaaColumn,
          value: gradeGroup.value!,
          maxValue: planEntry && plan?.recovery?.maxGrade && isRecovery
            ? plan.recovery.maxGrade
            : 10,
          weight: isRecovery ? undefined : planEntry?.weight,
          isRecovery,
          topics: isRecovery ? undefined : planEntry?.topics,
        });
        result.grades++;
      }
    });

    // --- Notícias / Avisos do SIGAA ---
    (course.news ?? []).forEach((item) => {
      if (item.date) {
        const newsDate = new Date(item.date);
        if (newsDate < recencyCutoff) return;
      }

      const hash = buildSigaaHash(subject!.id, item.title, item.date);
      const created = alertService.createAlertIfNew({
        subjectId: subject!.id,
        subjectName: subject!.name,
        title: item.title,
        content: item.content ?? undefined,
        date: item.date ?? undefined,
        sigaaHash: hash,
      });
      if (created) result.alerts++;
    });

    logSigaaImport(`Disciplina concluida "${course.title}"`, {
      createdSubjects: result.subjects - beforeCourse.subjects,
      createdAssessments: result.assessments - beforeCourse.assessments,
      createdTasks: result.tasks - beforeCourse.tasks,
      createdMaterials: result.materials - beforeCourse.materials,
      createdGrades: result.grades - beforeCourse.grades,
      createdAlerts: result.alerts - beforeCourse.alerts,
      skipped: result.skipped - beforeCourse.skipped,
    });
  });

  logSigaaImport('Importacao concluida', result);
  return result;
}
