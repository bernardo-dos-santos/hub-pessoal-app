import { generateId } from '../../../shared/utils/generateId';
import {
  DEFAULT_EXPANSION_CATEGORY,
  type ExpansionCategory,
  type ExpansionComplexity,
  type ExpansionFeasibility,
  type ExpansionStatus,
  type ProjectExpansion,
} from '../types/projectExpansion';
import { readExpansions, touch, writeExpansions } from './projectStorage';

type CreateExpansionInput = {
  projectId: string;
  title: string;
  category: ExpansionCategory;
  complexity: ExpansionComplexity;
  description?: string;
  feasibility?: ExpansionFeasibility;
  feasibilityNote?: string;
};

const COMPLEXITY_WEIGHT: Record<ExpansionComplexity, number> = { low: 0, medium: 1, high: 2 };

export const projectExpansionService = {
  listByProject(projectId: string): ProjectExpansion[] {
    return readExpansions()
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => {
        // Descartadas afundam; o resto ordena por esforço, do mais barato ao mais caro.
        const discardedDiff = Number(a.status === 'discarded') - Number(b.status === 'discarded');
        if (discardedDiff !== 0) return discardedDiff;
        return COMPLEXITY_WEIGHT[a.complexity] - COMPLEXITY_WEIGHT[b.complexity];
      });
  },

  countBacklog(projectId: string): number {
    return readExpansions().filter((e) => e.projectId === projectId && e.status === 'backlog').length;
  },

  /**
   * Categorias já usadas neste projeto, para sugerir em vez de impor.
   * É o que substitui a união fechada: o vocabulário emerge do uso, e quem
   * cadastra a segunda ideia reaproveita a categoria da primeira com um toque.
   */
  listCategories(projectId: string): ExpansionCategory[] {
    const seen = new Map<string, string>();
    for (const e of readExpansions()) {
      if (e.projectId !== projectId) continue;
      const category = e.category?.trim() || DEFAULT_EXPANSION_CATEGORY;
      // Chave em minúsculas só para deduplicar — o rótulo guardado é o digitado.
      if (!seen.has(category.toLowerCase())) seen.set(category.toLowerCase(), category);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  },

  create(input: CreateExpansionInput): ProjectExpansion {
    const title = input.title.trim();
    if (!title) throw new Error('Descreva a ideia de expansão.');

    const now = new Date().toISOString();
    const expansion: ProjectExpansion = {
      id: generateId('expansion'),
      projectId: input.projectId,
      title,
      description: input.description?.trim() || undefined,
      category: input.category.trim() || DEFAULT_EXPANSION_CATEGORY,
      complexity: input.complexity,
      status: 'backlog',
      feasibility: input.feasibility,
      feasibilityNote: input.feasibilityNote?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    writeExpansions([...readExpansions(), expansion]);
    touch(input.projectId);
    return expansion;
  },

  /** Renomeia. Título vazio é ignorado — a UI já bloqueia, isto é a segunda trava. */
  setTitle(id: string, title: string): ProjectExpansion | null {
    const next = title.trim();
    if (!next) return null;
    const expansions = readExpansions();
    const expansion = expansions.find((e) => e.id === id);
    if (!expansion || expansion.title === next) return expansion ?? null;
    expansion.title = next;
    expansion.updatedAt = new Date().toISOString();
    writeExpansions(expansions);
    touch(expansion.projectId);
    return expansion;
  },

  setStatus(id: string, status: ExpansionStatus): ProjectExpansion | null {
    const expansions = readExpansions();
    const expansion = expansions.find((e) => e.id === id);
    if (!expansion) return null;

    expansion.status = status;
    expansion.updatedAt = new Date().toISOString();
    writeExpansions(expansions);
    touch(expansion.projectId);
    return expansion;
  },

  remove(id: string): boolean {
    const expansion = readExpansions().find((e) => e.id === id);
    if (!expansion) return false;
    writeExpansions(readExpansions().filter((e) => e.id !== id));
    touch(expansion.projectId);
    return true;
  },
};
