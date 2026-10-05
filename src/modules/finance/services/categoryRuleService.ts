import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type AccountType, type FinanceScope, type TransactionKind, type TransactionSource } from '../types/finance';
import { type CategoryRule, type CategoryRuleMatch } from '../types/category';
import { type Transaction } from '../types/transaction';
import { extractMerchant, matchesRuleKeyword, normalizeRuleText, normalizeText } from '../utils/financeText';

const categoryRulesStorageKey = 'finance.categoryRules';

let memoryCategoryRules: CategoryRule[] | null = null;

export type CategoryRuleInput = {
  name?: string;
  keyword: string;
  category: string;
  categoryId?: string;
  kind?: TransactionKind;
  scope?: FinanceScope;
  accountType?: AccountType;
  source?: TransactionSource;
  isActive?: boolean;
};

export type CategoryRuleMatchInput = {
  description: string;
  manualCategory?: boolean;
  category?: string;
  scope?: FinanceScope;
  accountType?: AccountType;
  source?: TransactionSource;
};

function readCategoryRules() {
  return storageAdapter.getItem<CategoryRule[]>(categoryRulesStorageKey) ?? memoryCategoryRules ?? [];
}

function writeCategoryRules(rules: CategoryRule[]) {
  memoryCategoryRules = rules;
  storageAdapter.setItem(categoryRulesStorageKey, rules);
}

function normalizedRuleKeyword(keyword: string) {
  return normalizeRuleText(keyword);
}

function defaultRuleName(keyword: string, category: string) {
  return `${keyword.trim()} -> ${category.trim()}`;
}

function assertValidRuleKeyword(keyword: string) {
  const normalizedKeyword = normalizedRuleKeyword(keyword);

  if (!normalizedKeyword) {
    throw new Error('A palavra-chave da regra nao pode ficar vazia.');
  }

  return normalizedKeyword;
}

function hasDuplicateRule(rules: CategoryRule[], normalizedKeyword: string, category: string, currentRuleId?: string) {
  return rules.some(
    (rule) =>
      rule.id !== currentRuleId &&
      rule.normalizedKeyword === normalizedKeyword &&
      normalizeText(rule.category) === normalizeText(category),
  );
}

function matchesRuleContext(rule: CategoryRule, input: CategoryRuleMatchInput) {
  if (rule.scope && rule.scope !== input.scope) {
    return false;
  }

  if (rule.accountType && rule.accountType !== input.accountType) {
    return false;
  }

  if (rule.source && rule.source !== input.source) {
    return false;
  }

  return true;
}

function createRuleMatch(rule: CategoryRule): CategoryRuleMatch {
  return {
    ruleId: rule.id,
    ruleKeyword: rule.keyword,
    category: rule.category,
    kind: rule.kind,
    confidence: rule.normalizedKeyword.length <= 3 ? 'medium' : 'high',
    reason: `Regra manual: ${rule.keyword} -> ${rule.category}.`,
  };
}

function relevantRuleTokens(rule: CategoryRule) {
  const ignoredTokens = new Set(['a', 'as', 'da', 'das', 'de', 'do', 'dos', 'e', 'o', 'os']);
  return rule.normalizedKeyword
    .split(' ')
    .filter((token) => token.length > 0 && !ignoredTokens.has(token));
}

function compareRuleSpecificity(left: CategoryRule, right: CategoryRule) {
  const explicitKindDifference = Number(Boolean(right.kind)) - Number(Boolean(left.kind));

  if (explicitKindDifference !== 0) {
    return explicitKindDifference;
  }

  const tokenDifference = relevantRuleTokens(right).length - relevantRuleTokens(left).length;

  if (tokenDifference !== 0) {
    return tokenDifference;
  }

  const keywordLength = (rule: CategoryRule) => relevantRuleTokens(rule).join(' ').length;
  return keywordLength(right) - keywordLength(left);
}

function getDescriptionInput(input: CategoryRuleMatchInput | string): CategoryRuleMatchInput {
  return typeof input === 'string' ? { description: input } : input;
}

export const categoryRuleService = {
  listCategoryRules(): CategoryRule[] {
    return readCategoryRules();
  },

  getActiveCategoryRules(): CategoryRule[] {
    return readCategoryRules().filter((rule) => rule.isActive);
  },

  createCategoryRule(input: CategoryRuleInput): CategoryRule {
    const keyword = input.keyword.trim();
    const category = input.category.trim();
    const normalizedKeyword = assertValidRuleKeyword(keyword);
    const rules = readCategoryRules();

    if (!category) {
      throw new Error('A categoria da regra nao pode ficar vazia.');
    }

    if (hasDuplicateRule(rules, normalizedKeyword, category)) {
      throw new Error('Ja existe uma regra com esta palavra-chave e categoria.');
    }

    const now = new Date().toISOString();
    const rule: CategoryRule = {
      id: generateId(),
      name: input.name?.trim() || defaultRuleName(keyword, category),
      keyword,
      normalizedKeyword,
      category,
      categoryId: input.categoryId,
      kind: input.kind,
      scope: input.scope,
      accountType: input.accountType,
      source: input.source,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    writeCategoryRules([rule, ...rules]);
    return rule;
  },

  updateCategoryRule(id: string, updates: Partial<CategoryRuleInput>): CategoryRule | null {
    const rules = readCategoryRules();
    const currentRule = rules.find((rule) => rule.id === id);

    if (!currentRule) {
      return null;
    }

    const keyword = updates.keyword?.trim() ?? currentRule.keyword;
    const category = updates.category?.trim() ?? currentRule.category;
    const normalizedKeyword = assertValidRuleKeyword(keyword);

    if (!category) {
      throw new Error('A categoria da regra nao pode ficar vazia.');
    }

    if (hasDuplicateRule(rules, normalizedKeyword, category, id)) {
      throw new Error('Ja existe uma regra com esta palavra-chave e categoria.');
    }

    let updatedRule: CategoryRule | null = null;
    const nextRules = rules.map((rule) => {
      if (rule.id !== id) {
        return rule;
      }

      updatedRule = {
        ...rule,
        ...updates,
        keyword,
        normalizedKeyword,
        category,
        name: updates.name?.trim() || rule.name || defaultRuleName(keyword, category),
        updatedAt: new Date().toISOString(),
      };

      return updatedRule;
    });

    writeCategoryRules(nextRules);
    return updatedRule;
  },

  deleteCategoryRule(id: string): boolean {
    const rules = readCategoryRules();
    const nextRules = rules.filter((rule) => rule.id !== id);

    if (nextRules.length === rules.length) {
      return false;
    }

    writeCategoryRules(nextRules);
    return true;
  },

  toggleCategoryRule(id: string): CategoryRule | null {
    const rule = readCategoryRules().find((item) => item.id === id);
    return rule ? this.updateCategoryRule(id, { isActive: !rule.isActive }) : null;
  },

  findMatchingCategoryRule(input: CategoryRuleMatchInput | string): CategoryRuleMatch | null {
    const matchInput = getDescriptionInput(input);

    if (matchInput.manualCategory && matchInput.category) {
      return null;
    }

    const rule = this.getActiveCategoryRules()
      .filter(
        (item) =>
          matchesRuleContext(item, matchInput) &&
          matchesRuleKeyword(matchInput.description, item.normalizedKeyword),
      )
      .sort(compareRuleSpecificity)[0];

    return rule ? createRuleMatch(rule) : null;
  },

  applyCategoryRules(input: CategoryRuleMatchInput | string): CategoryRuleMatch | null {
    return this.findMatchingCategoryRule(input);
  },

  /**
   * `kind` é o que torna a regra aplicável em lote: sem ele, a regra é tratada
   * como "manter classificador" e o preview de aplicação a descarta por não
   * decidir o tipo com segurança. Criada a partir de uma revisão, o tipo já foi
   * escolhido à mão ali — repassá-lo é o que faz a regra valer pros lançamentos
   * parecidos que ainda estão na fila, em vez de só pro que está aberto.
   */
  createRuleFromTransaction(
    transaction: Transaction,
    category: string,
    keyword?: string,
    kind?: TransactionKind,
  ): CategoryRule {
    const merchant = extractMerchant(transaction.description).trim();
    const ruleKeyword = keyword?.trim() || merchant || transaction.description;

    return this.createCategoryRule({
      keyword: ruleKeyword,
      category,
      kind,
    });
  },

  clearCategoryRules(): void {
    memoryCategoryRules = null;
    storageAdapter.removeItem(categoryRulesStorageKey);
  },
};

export const {
  applyCategoryRules,
  createCategoryRule,
  createRuleFromTransaction,
  deleteCategoryRule,
  findMatchingCategoryRule,
  getActiveCategoryRules,
  listCategoryRules,
  toggleCategoryRule,
  updateCategoryRule,
} = categoryRuleService;
