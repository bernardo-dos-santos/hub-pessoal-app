import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type Question } from '../types/question';

const STORAGE_KEY = 'study.questions';

export type NewQuestion = Omit<Question, 'id' | 'createdAt'>;

export const questionService = {
  listQuestions(): Question[] {
    return storageAdapter.getItem<Question[]>(STORAGE_KEY) ?? [];
  },

  listByContent(contentId: string): Question[] {
    return this.listQuestions().filter((q) => q.contentId === contentId);
  },

  listByMaterial(materialId: string): Question[] {
    return this.listQuestions().filter((q) => q.materialIds?.includes(materialId));
  },

  /** IDs únicos de materiais que possuem questões vinculadas. */
  listLinkedMaterialIds(): string[] {
    return [...new Set(
      this.listQuestions().flatMap((q) => q.materialIds ?? [])
    )];
  },

  listBySubject(subjectTag: string): Question[] {
    return this.listQuestions().filter((q) => q.subjectTag === subjectTag);
  },

  getById(id: string): Question | null {
    return this.listQuestions().find((q) => q.id === id) ?? null;
  },

  listSubjects(): string[] {
    return [...new Set(this.listQuestions().map((q) => q.subjectTag))].sort();
  },

  listTags(): string[] {
    return [...new Set(this.listQuestions().flatMap((q) => q.tags))].sort();
  },

  count(): number {
    return this.listQuestions().length;
  },

  /** Salva várias questões de uma vez (ex.: lote gerado pela IA). */
  addMany(questions: NewQuestion[]): Question[] {
    const now = new Date().toISOString();
    const created = questions.map((q) => ({ ...q, id: generateId(), createdAt: now }));
    storageAdapter.setItem(STORAGE_KEY, [...created, ...this.listQuestions()]);
    return created;
  },

  delete(id: string): void {
    storageAdapter.setItem(STORAGE_KEY, this.listQuestions().filter((q) => q.id !== id));
  },

  /** Remove todas as questões deste subjectTag. Retorna os IDs removidos (pra limpar dados dependentes, ex.: FSRS). */
  removeBySubjectTag(subjectTag: string): string[] {
    const questions = this.listQuestions();
    const removedIds = questions.filter((q) => q.subjectTag === subjectTag).map((q) => q.id);
    if (removedIds.length > 0) {
      storageAdapter.setItem(STORAGE_KEY, questions.filter((q) => q.subjectTag !== subjectTag));
    }
    return removedIds;
  },
};
