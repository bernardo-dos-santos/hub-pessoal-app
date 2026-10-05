import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { questionService } from './questionService';
import type { ErrorNotebookEntry } from '../types/errorNotebook';
import type { SimuladoResult } from '../types/simulado';

const STORAGE_KEY = 'study.errorNotebook';

export const errorNotebookService = {
  listEntries(): ErrorNotebookEntry[] {
    return (storageAdapter.getItem<ErrorNotebookEntry[]>(STORAGE_KEY) ?? []).sort((a, b) =>
      b.firstFailedAt.localeCompare(a.firstFailedAt),
    );
  },

  /**
   * `excludeTags` é opcional e EXCLUSIVO (não inclusivo) — pensado pra tirar
   * tag de matéria arquivada de recomendação automática (dashboard "Hoje",
   * Jarvis, planner) sem esconder tópico de concurso, que usa subjectTag
   * livre sem registro em `subjectService` (ver o comentário lá).
   */
  listPending(excludeTags?: Set<string>): ErrorNotebookEntry[] {
    return this.listEntries().filter(
      (e) => e.status !== 'mastered' && !excludeTags?.has(e.subjectTag),
    );
  },

  listBySubject(tag: string): ErrorNotebookEntry[] {
    return this.listEntries().filter((e) => e.subjectTag === tag);
  },

  countPending(excludeTags?: Set<string>): number {
    return this.listPending(excludeTags).length;
  },

  /** Alimenta o caderno automaticamente a partir de um resultado de simulado. */
  addFromResult(result: SimuladoResult): void {
    const now = new Date().toISOString();
    const entries = this.listEntries();

    for (const answer of result.answers) {
      if (answer.status === 'correct') continue;
      const question = questionService.getById(answer.questionId);
      if (!question) continue;

      const existing = entries.find((e) => e.questionId === answer.questionId);
      if (existing) {
        existing.timesFailed += 1;
        existing.lastReviewedAt = now;
        if (existing.status === 'mastered') existing.status = 'pending';
      } else {
        entries.unshift({
          id: generateId(),
          questionId: answer.questionId,
          subjectTag: question.subjectTag,
          chosenOption: answer.chosenOption,
          correctOption: question.correctOption,
          reason: answer.status === 'unknown' ? 'unknown' : 'wrong',
          usedHint: answer.usedHint,
          status: 'pending',
          firstFailedAt: now,
          lastReviewedAt: null,
          timesFailed: 1,
        });
      }
    }

    storageAdapter.setItem(STORAGE_KEY, entries);
  },

  markMastered(id: string): void {
    const entries = this.listEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entry.status = 'mastered';
    entry.lastReviewedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEY, entries);
  },

  markReviewing(id: string): void {
    const entries = this.listEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entry.status = 'reviewing';
    entry.lastReviewedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEY, entries);
  },

  delete(id: string): void {
    storageAdapter.setItem(
      STORAGE_KEY,
      this.listEntries().filter((e) => e.id !== id),
    );
  },

  /** Remove todas as entradas deste subjectTag. Retorna quantas foram removidas. */
  removeBySubjectTag(tag: string): number {
    const entries = this.listEntries();
    const kept = entries.filter((e) => e.subjectTag !== tag);
    const removed = entries.length - kept.length;
    if (removed > 0) storageAdapter.setItem(STORAGE_KEY, kept);
    return removed;
  },
};
