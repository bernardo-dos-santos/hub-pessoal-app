import { type GoalCategory } from '../types/goal';

export type GoalCategoryMeta = { value: GoalCategory; label: string; emoji: string; color: string };

export const GOAL_CATEGORIES: GoalCategoryMeta[] = [
  { value: 'financeiro', label: 'Financeiro', emoji: '💰', color: 'var(--hub-positive)' },
  { value: 'saude',      label: 'Saúde',      emoji: '💪', color: 'var(--hub-accent)' },
  { value: 'faculdade',  label: 'Faculdade',  emoji: '🎓', color: 'var(--hub-warning)' },
  { value: 'pessoal',    label: 'Pessoal',    emoji: '⭐', color: 'var(--hub-mauve)' },
];

/**
 * Meta salva com uma categoria que deixou de existir (a antiga `concurso`)
 * continua aparecendo, como "Outra", em vez de quebrar o rótulo e a cor.
 */
export function goalCategoryMeta(category: string): Omit<GoalCategoryMeta, 'value'> {
  return GOAL_CATEGORIES.find((c) => c.value === category)
    ?? { label: 'Outra', emoji: '•', color: 'var(--hub-muted)' };
}
