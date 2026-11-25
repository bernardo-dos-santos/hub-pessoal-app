import { isSameCategory, SPECIAL_CATEGORIES } from '../../../shared/finance/financeTotals.js';
import { budgetService } from './budgetService';
import { categoryRuleService } from './categoryRuleService';
import { transactionService } from './transactionService';

/**
 * A category name is stored as text on transactions, budgets and rules. Renaming
 * only the category list (as it used to) left all three pointing at the old
 * name: the budget showed R$ 0 and the rule filed new entries under a category
 * that no longer existed. These keep the three in step.
 */
export const categoryUsageService = {
  countUsage(name: string) {
    return {
      transactions: transactionService.listTransactions().filter((t) => isSameCategory(t.category, name)).length,
      budgets: budgetService.listBudgets().filter((b) => isSameCategory(b.category, name)).length,
      rules: categoryRuleService.listCategoryRules().filter((r) => isSameCategory(r.category, name)).length,
    };
  },

  renameEverywhere(oldName: string, newName: string) {
    if (!newName.trim() || isSameCategory(oldName, newName) && oldName === newName) return;
    transactionService.replaceTransactions(
      transactionService.listTransactions().map((t) => (isSameCategory(t.category, oldName) ? { ...t, category: newName } : t)),
    );
    for (const budget of budgetService.listBudgets()) {
      if (isSameCategory(budget.category, oldName)) budgetService.updateBudget(budget.id, { category: newName });
    }
    for (const rule of categoryRuleService.listCategoryRules()) {
      if (isSameCategory(rule.category, oldName)) categoryRuleService.updateCategoryRule(rule.id, { category: newName });
    }
  },

  /**
   * Before deleting a category: its entries go back to Revisar (nothing is
   * silently filed elsewhere), its budgets and rules are switched off.
   */
  releaseCategory(name: string) {
    const now = new Date().toISOString();
    transactionService.replaceTransactions(
      transactionService.listTransactions().map((t) =>
        isSameCategory(t.category, name)
          ? {
              ...t,
              category: t.amount > 0 ? SPECIAL_CATEGORIES.incomeReview : SPECIAL_CATEGORIES.expenseReview,
              manualCategory: false,
              needsReview: true,
              reviewedAt: undefined,
              classificationReason: `A categoria "${name}" foi excluída.`,
              updatedAt: now,
            }
          : t,
      ),
    );
    for (const budget of budgetService.listBudgets()) {
      if (isSameCategory(budget.category, name) && budget.isActive) budgetService.toggleBudget(budget.id);
    }
    for (const rule of categoryRuleService.listCategoryRules()) {
      if (isSameCategory(rule.category, name) && rule.isActive) categoryRuleService.toggleCategoryRule(rule.id);
    }
  },
};
