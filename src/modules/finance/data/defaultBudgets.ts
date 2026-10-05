import { type Budget } from '../types/budget';
import { specialCategories } from './specialCategories';

const createdAt = '2026-05-20T00:00:00.000Z';

export const defaultBudgets: Budget[] = [
  {
    id: 'budget-mercado',
    name: 'Mercado',
    category: 'Mercado',
    categoryId: 'mercado',
    limit: 1200,
    scope: 'pessoal',
    period: 'monthly',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'budget-alimentacao-fora',
    name: specialCategories.foodOut,
    category: specialCategories.foodOut,
    categoryId: 'alimentacao-fora',
    limit: 600,
    scope: 'pessoal',
    period: 'monthly',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
];
