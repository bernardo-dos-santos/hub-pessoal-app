import { storageAdapter } from '../../../core/storage/storage.adapter';

const KEY = 'study.summaryCache';

export type SummaryCacheEntry = { text: string; generatedAt: string };

/**
 * Cache de resumo por (disciplina, formato, materiais).
 *
 * Não é persistência do resumo — isso é `studyContentService`. Serve só para não
 * gastar uma chamada de IA repetindo exatamente a mesma combinação. Extraído da
 * `GeneratePage` para ser compartilhado pelas telas de gerar.
 */
export const summaryCacheService = {
  makeId(subjectTag: string, format: string, materialIds: string[]): string {
    return `${subjectTag}:${format}:${[...materialIds].sort().join(',')}`;
  },

  read(id: string): SummaryCacheEntry | null {
    const cache = storageAdapter.getItem<Record<string, SummaryCacheEntry>>(KEY) ?? {};
    return cache[id] ?? null;
  },

  write(id: string, text: string): void {
    const cache = storageAdapter.getItem<Record<string, SummaryCacheEntry>>(KEY) ?? {};
    cache[id] = { text, generatedAt: new Date().toISOString() };
    storageAdapter.setItem(KEY, cache);
  },
};
