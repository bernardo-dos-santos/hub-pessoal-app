import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { collegeStorageKeys, defaultCollegeData, defaultSubjectColors } from '../data/defaultCollegeData';
import { type Subject } from '../types/subject';
import { getCurrentSemester } from '../utils/collegePeriod';
import { alertService } from './alertService';
import { assessmentService } from './assessmentService';
import { gradeService } from './gradeService';
import { materialService } from './materialService';
import { taskService } from './taskService';
import { deckService } from '../../study/services/deckService';
import { errorNotebookService } from '../../study/services/errorNotebookService';
import { forgetDeletedSubject, rememberDeletedSubject } from './sigaaTombstones';
import { questionService } from '../../study/services/questionService';
import { studyContentService } from '../../study/services/studyContentService';

/** O que foi apagado junto com a disciplina, para confirmar/avisar na UI. */
export type SubjectRemovalSummary = {
  tasks: number;
  assessments: number;
  grades: number;
  materials: number;
  alerts: number;
  studyContents: number;
  questions: number;
  errorNotebookEntries: number;
  decks: number;
  flashcards: number;
};

/**
 * O módulo Estudos (conteúdos, questões, caderno de erros, decks) marca tudo por
 * `subjectTag` — texto livre, sem FK real pro `id` da disciplina — porque o campo é
 * digitado/selecionado na hora de gerar o conteúdo, não vinculado à disciplina em si.
 * Junta nome + apelidos: o usuário pode ter gerado conteúdo usando um apelido em vez
 * do nome canônico.
 */
function subjectTagsFor(name: string, aliases: string[]): string[] {
  return [...new Set([name, ...aliases])];
}

export function isEmptyRemoval(summary: SubjectRemovalSummary): boolean {
  return Object.values(summary).every((count) => count === 0);
}

type CreateSubjectInput = Omit<Subject, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'semester'> & {
  semester?: string;
  status?: Subject['status'];
};
type UpdateSubjectInput = Partial<Omit<Subject, 'id' | 'createdAt'>>;

let memorySubjects: Subject[] | null = null;

function readSubjects() {
  return storageAdapter.getItem<Subject[]>(collegeStorageKeys.subjects) ?? memorySubjects ?? defaultCollegeData.subjects;
}

function writeSubjects(subjects: Subject[]) {
  memorySubjects = subjects;
  storageAdapter.setItem(collegeStorageKeys.subjects, subjects);
}

function nextSubjectColor() {
  const subjects = readSubjects();
  return defaultSubjectColors[subjects.length % defaultSubjectColors.length];
}

/**
 * Tags (nome + apelidos) das matérias arquivadas/concluídas — usado por quem
 * gera recomendação automática de estudo (planner, Jarvis, dashboard "Hoje")
 * pra não puxar matéria de semestre encerrado. É EXCLUSIVO, não inclusivo:
 * o módulo Estudos também usa `subjectTag` pra tópico de concurso sem nenhum
 * registro aqui (ver o grupo "Concurso" do StudySourcePicker) — um filtro por
 * inclusão ("só tag de matéria ativa") apagaria esse conteúdo inteiro. Só
 * tag que pertence a uma matéria arquivada some; todo o resto passa.
 */
function archivedSubjectTags(subjects: Subject[]): Set<string> {
  return new Set(
    subjects
      .filter((s) => s.status !== 'active')
      .flatMap((s) => [s.name, ...(s.aliases ?? [])]),
  );
}

export function normalizeSubjectAliases(aliases?: string[]) {
  return [...new Set((aliases ?? [])
    .map((alias) => alias.trim())
    .filter(Boolean))];
}

export const subjectService = {
  listSubjects(): Subject[] {
    return readSubjects();
  },

  listActiveSubjects(): Subject[] {
    return readSubjects().filter((subject) => subject.status === 'active');
  },

  /** Ver o comentário de `archivedSubjectTags` acima — filtro exclusivo, não inclusivo. */
  listArchivedSubjectTags(): Set<string> {
    return archivedSubjectTags(readSubjects());
  },

  getSubjectById(id: string): Subject | null {
    return readSubjects().find((subject) => subject.id === id) ?? null;
  },

  createSubject(input: CreateSubjectInput): Subject {
    const now = new Date().toISOString();
    const name = input.name.trim();

    if (!name) {
      throw new Error('Informe o nome da disciplina.');
    }

    // Criar de novo é mudar de ideia sobre ter apagado: a lápide sai. Seguro
    // mesmo quando quem cria é a importação do SIGAA, porque ela pula
    // disciplinas com lápide ANTES de chegar aqui (ver sigaaImportService).
    forgetDeletedSubject(name);

    const subject: Subject = {
      ...input,
      aliases: normalizeSubjectAliases(input.aliases),
      color: input.color || nextSubjectColor(),
      createdAt: now,
      id: generateId(),
      name,
      semester: input.semester?.trim() || getCurrentSemester(),
      status: input.status ?? 'active',
      updatedAt: now,
    };

    writeSubjects([subject, ...readSubjects()]);
    return subject;
  },

  updateSubject(id: string, updates: UpdateSubjectInput): Subject | null {
    let updatedSubject: Subject | null = null;
    const subjects = readSubjects().map((subject) => {
      if (subject.id !== id) {
        return subject;
      }

      updatedSubject = {
        ...subject,
        ...updates,
        aliases: updates.aliases ? normalizeSubjectAliases(updates.aliases) : subject.aliases,
        id: subject.id,
        createdAt: subject.createdAt,
        name: updates.name?.trim() || subject.name,
        semester: updates.semester?.trim() || subject.semester,
        updatedAt: new Date().toISOString(),
      };

      return updatedSubject;
    });

    if (!updatedSubject) {
      return null;
    }

    writeSubjects(subjects);
    return updatedSubject;
  },

  archiveSubject(id: string): Subject | null {
    return this.updateSubject(id, { status: 'archived' });
  },

  /** Semestres distintos entre as disciplinas salvas, do mais recente pro mais antigo. */
  listSemesters(): string[] {
    return [...new Set(readSubjects().map((s) => s.semester))].sort().reverse();
  },

  /**
   * Arquiva todas as disciplinas ativas de um semestre de uma vez (fechamento de
   * semestre). Não apaga nada — tarefas/avaliações/notas/materiais já vinculados
   * continuam existindo e visíveis no histórico; só param de contar como trabalho
   * ativo em `listActiveSubjects()` (Planner, Estudos e os seletores de disciplina
   * do próprio módulo Faculdade).
   */
  closeSemester(semester: string): Subject[] {
    const toClose = readSubjects().filter((s) => s.semester === semester && s.status === 'active');
    for (const subject of toClose) {
      this.archiveSubject(subject.id);
    }
    return toClose;
  },

  /**
   * Conta o que seria apagado junto com a disciplina, sem apagar nada.
   * Serve pra confirmação antes de uma exclusão irreversível.
   */
  previewRemoval(id: string): SubjectRemovalSummary {
    const subject = readSubjects().find((s) => s.id === id);
    const tags = subject ? subjectTagsFor(subject.name, subject.aliases ?? []) : [];

    let studyContents = 0, questions = 0, errorNotebookEntries = 0, decks = 0, flashcards = 0;
    for (const tag of tags) {
      studyContents += studyContentService.listContents().filter((c) => c.subjectTag === tag).length;
      questions += questionService.listBySubject(tag).length;
      errorNotebookEntries += errorNotebookService.listBySubject(tag).length;
      const tagDecks = deckService.listDecks().filter((d) => d.subjectTag === tag);
      decks += tagDecks.length;
      flashcards += tagDecks.reduce((sum, d) => sum + deckService.listCards(d.id).length, 0);
    }

    return {
      tasks: taskService.listTasks().filter((t) => t.subjectId === id).length,
      assessments: assessmentService.listAssessments().filter((a) => a.subjectId === id).length,
      grades: gradeService.listGrades().filter((g) => g.subjectId === id).length,
      materials: materialService.listMaterials().filter((m) => m.subjectId === id).length,
      alerts: alertService.listAlerts().filter((a) => a.subjectId === id).length,
      studyContents,
      questions,
      errorNotebookEntries,
      decks,
      flashcards,
    };
  },

  /**
   * Exclui a disciplina E tudo que pertence a ela — tarefas, avaliações, notas,
   * materiais (com anexos), avisos, e (Estudos, por subjectTag) conteúdos,
   * questões, caderno de erros e decks/flashcards. Antes isto removia só a
   * disciplina, e o resto virava dado órfão: tarefas/prazos continuavam
   * contando pra uma disciplina que não existe mais, e o Planner seguia
   * recomendando revisão de matéria e conteúdo já apagados (lidos do caderno
   * de erros pendente, ver aiWeeklyPlanService.errorCounts()).
   */
  removeSubject(id: string): SubjectRemovalSummary {
    const subject = readSubjects().find((s) => s.id === id);
    const tags = subject ? subjectTagsFor(subject.name, subject.aliases ?? []) : [];

    let studyContents = 0, questions = 0, errorNotebookEntries = 0, decks = 0, flashcards = 0;
    for (const tag of tags) {
      studyContents += studyContentService.removeBySubjectTag(tag).length;
      const removedQuestionIds = questionService.removeBySubjectTag(tag);
      questions += removedQuestionIds.length;
      deckService.removeQuestCardStatesFor(removedQuestionIds);
      errorNotebookEntries += errorNotebookService.removeBySubjectTag(tag);
      const deckResult = deckService.removeBySubjectTag(tag);
      decks += deckResult.decks;
      flashcards += deckResult.cards;
    }

    const removed: SubjectRemovalSummary = {
      tasks: taskService.removeBySubject(id),
      assessments: assessmentService.removeBySubject(id),
      grades: gradeService.removeBySubject(id),
      materials: materialService.removeBySubject(id),
      alerts: alertService.removeBySubject(id),
      studyContents,
      questions,
      errorNotebookEntries,
      decks,
      flashcards,
    };

    writeSubjects(readSubjects().filter((s) => s.id !== id));
    // Registra a exclusão para a importação do SIGAA não recriar a disciplina
    // no próximo sync. Sem isto, apagar era um gesto que durava até as 19h.
    if (subject) rememberDeletedSubject(subject.name);
    return removed;
  },

  clearSubjects(): void {
    memorySubjects = null;
    storageAdapter.removeItem(collegeStorageKeys.subjects);
  },
};
