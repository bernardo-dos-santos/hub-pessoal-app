import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { defaultCategories } from '../data/defaultCategories';
import { type Category, type CategoryType } from '../types/category';
import { type FinanceScope } from '../types/finance';
import { normalizeText } from '../utils/financeText';

const customCategoriesStorageKey = 'finance.customCategories';

let memoryCustomCategories: Category[] | null = null;

export type CategoryInput = {
  name: string;
  type?: CategoryType;
  scope?: FinanceScope;
  color?: string;
  icon?: string;
};

function readCustomCategories() {
  return storageAdapter.getItem<Category[]>(customCategoriesStorageKey) ?? memoryCustomCategories ?? [];
}

function writeCustomCategories(categories: Category[]) {
  memoryCustomCategories = categories;
  storageAdapter.setItem(customCategoriesStorageKey, categories);
}

function normalizedName(name: string) {
  return normalizeText(name);
}

function assertCategoryName(name: string, currentId?: string) {
  const cleanName = name.trim();
  const normalized = normalizedName(cleanName);

  if (!normalized) {
    throw new Error('O nome da categoria nao pode ficar vazio.');
  }

  const duplicate = [...defaultCategories, ...readCustomCategories()].find(
    (category) => category.id !== currentId && normalizedName(category.name) === normalized,
  );

  if (duplicate) {
    throw new Error('Ja existe uma categoria com este nome.');
  }

  return cleanName;
}

function findProtectedCategory(id: string) {
  return defaultCategories.find((category) => category.id === id) ?? null;
}

export const categoryService = {
  listCategories(): Category[] {
    return [...this.listDefaultCategories(), ...this.listSpecialCategories(), ...this.listCustomCategories()];
  },

  listDefaultCategories(): Category[] {
    return defaultCategories.filter((category) => !category.isSpecial);
  },

  listSpecialCategories(): Category[] {
    return defaultCategories.filter((category) => category.isSpecial);
  },

  listCustomCategories(): Category[] {
    return readCustomCategories();
  },

  getAvailableCategories(): Category[] {
    return this.listCategories().filter((category) => category.isActive);
  },

  createCategory(input: CategoryInput): Category {
    const now = new Date().toISOString();
    const category: Category = {
      id: generateId(),
      name: assertCategoryName(input.name),
      type: input.type ?? 'expense',
      scope: input.scope,
      color: input.color,
      icon: input.icon,
      isDefault: false,
      isSpecial: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    writeCustomCategories([category, ...readCustomCategories()]);
    return category;
  },

  updateCategory(id: string, updates: Partial<CategoryInput>): Category | null {
    if (findProtectedCategory(id)) {
      return null;
    }

    let updatedCategory: Category | null = null;
    const nextCategories = readCustomCategories().map((category) => {
      if (category.id !== id) {
        return category;
      }

      updatedCategory = {
        ...category,
        ...updates,
        name: updates.name === undefined ? category.name : assertCategoryName(updates.name, id),
        updatedAt: new Date().toISOString(),
      };

      return updatedCategory;
    });

    if (!updatedCategory) {
      return null;
    }

    writeCustomCategories(nextCategories);
    return updatedCategory;
  },

  deleteCategory(id: string): boolean {
    if (findProtectedCategory(id)) {
      return false;
    }

    const categories = readCustomCategories();
    const nextCategories = categories.filter((category) => category.id !== id);

    if (nextCategories.length === categories.length) {
      return false;
    }

    writeCustomCategories(nextCategories);
    return true;
  },

  toggleCategory(id: string): Category | null {
    const category = readCustomCategories().find((item) => item.id === id);
    return category ? this.setCategoryActive(id, !category.isActive) : null;
  },

  setCategoryActive(id: string, isActive: boolean): Category | null {
    if (findProtectedCategory(id)) {
      return null;
    }

    let updatedCategory: Category | null = null;
    const nextCategories = readCustomCategories().map((category) => {
      if (category.id !== id) {
        return category;
      }

      updatedCategory = {
        ...category,
        isActive,
        updatedAt: new Date().toISOString(),
      };

      return updatedCategory;
    });

    if (!updatedCategory) {
      return null;
    }

    writeCustomCategories(nextCategories);
    return updatedCategory;
  },

  clearCustomCategories(): void {
    memoryCustomCategories = null;
    storageAdapter.removeItem(customCategoriesStorageKey);
  },
};

export const {
  createCategory,
  deleteCategory,
  getAvailableCategories,
  listCategories,
  listCustomCategories,
  listDefaultCategories,
  listSpecialCategories,
  toggleCategory,
  updateCategory,
} = categoryService;
