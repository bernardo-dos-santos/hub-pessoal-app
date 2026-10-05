import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type StudyContent } from '../types/content';

const STORAGE_KEY = 'study.contents';

export type NewStudyContent = Omit<StudyContent, 'id' | 'createdAt'>;

export const studyContentService = {
  listContents(): StudyContent[] {
    return (storageAdapter.getItem<StudyContent[]>(STORAGE_KEY) ?? []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },

  getById(id: string): StudyContent | null {
    return this.listContents().find((c) => c.id === id) ?? null;
  },

  create(input: NewStudyContent): StudyContent {
    const content: StudyContent = { ...input, id: generateId(), createdAt: new Date().toISOString() };
    storageAdapter.setItem(STORAGE_KEY, [content, ...this.listContents()]);
    return content;
  },

  update(id: string, patch: Partial<NewStudyContent>): StudyContent | null {
    const contents = this.listContents();
    const index = contents.findIndex((c) => c.id === id);
    if (index === -1) return null;
    contents[index] = { ...contents[index], ...patch };
    storageAdapter.setItem(STORAGE_KEY, contents);
    return contents[index];
  },

  delete(id: string): void {
    storageAdapter.setItem(STORAGE_KEY, this.listContents().filter((c) => c.id !== id));
  },

  /** Remove todo conteúdo marcado com este subjectTag. Retorna quantos IDs removidos. */
  removeBySubjectTag(tag: string): string[] {
    const contents = this.listContents();
    const removedIds = contents.filter((c) => c.subjectTag === tag).map((c) => c.id);
    if (removedIds.length > 0) {
      storageAdapter.setItem(STORAGE_KEY, contents.filter((c) => c.subjectTag !== tag));
    }
    return removedIds;
  },
};
