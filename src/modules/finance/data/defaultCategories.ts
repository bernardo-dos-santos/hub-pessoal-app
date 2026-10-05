import { type Category } from '../types/category';
import { specialCategories } from './specialCategories';

const createdAt = '2026-05-20T00:00:00.000Z';
const specialCategoryIds = new Set([
  'entrada-a-revisar',
  'despesa-a-revisar',
  'transferencia-interna',
  'pagamento-de-fatura',
  'pagamento-recebido-da-fatura',
]);

function defaultCategory(category: Omit<Category, 'isSpecial' | 'isActive' | 'createdAt' | 'updatedAt'>): Category {
  return {
    ...category,
    isSpecial: specialCategoryIds.has(category.id),
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
}

export const defaultCategories: Category[] = [
  defaultCategory({ id: 'alimentacao-fora', name: specialCategories.foodOut, type: 'expense', color: '#f97316', isDefault: true }),
  defaultCategory({ id: 'mercado', name: specialCategories.market, type: 'expense', color: '#22c55e', isDefault: true }),
  defaultCategory({ id: 'transporte', name: specialCategories.transport, type: 'expense', color: '#0ea5e9', isDefault: true }),
  defaultCategory({ id: 'moradia', name: specialCategories.housing, type: 'expense', color: '#64748b', isDefault: true }),
  defaultCategory({ id: 'saude', name: specialCategories.health, type: 'expense', color: '#ef4444', isDefault: true }),
  defaultCategory({ id: 'educacao', name: specialCategories.education, type: 'expense', color: '#8b5cf6', isDefault: true }),
  defaultCategory({ id: 'lazer', name: specialCategories.leisure, type: 'expense', color: '#ec4899', isDefault: true }),
  defaultCategory({ id: 'assinaturas', name: specialCategories.subscriptions, type: 'expense', color: '#14b8a6', isDefault: true }),
  defaultCategory({ id: 'pet', name: specialCategories.pet, type: 'expense', color: '#84cc16', isDefault: true }),
  defaultCategory({ id: 'academia', name: specialCategories.gym, type: 'expense', color: '#06b6d4', isDefault: true }),
  defaultCategory({ id: 'renda', name: specialCategories.income, type: 'income', color: '#16a34a', isDefault: true }),
  defaultCategory({ id: 'outros', name: specialCategories.other, type: 'expense', color: '#94a3b8', isDefault: true }),
  defaultCategory({ id: 'entrada-a-revisar', name: specialCategories.incomeReview, type: 'review', color: '#f59e0b', isDefault: true }),
  defaultCategory({ id: 'despesa-a-revisar', name: specialCategories.expenseReview, type: 'review', color: '#f43f5e', isDefault: true }),
  defaultCategory({ id: 'transferencia-interna', name: specialCategories.internalTransfer, type: 'transfer', color: '#38bdf8', isDefault: true }),
  defaultCategory({ id: 'pagamento-de-fatura', name: specialCategories.cardPayment, type: 'transfer', color: '#818cf8', isDefault: true }),
  defaultCategory({
    id: 'pagamento-recebido-da-fatura',
    name: specialCategories.cardPaymentReceived,
    type: 'transfer',
    color: '#a78bfa',
    isDefault: true,
  }),
];
