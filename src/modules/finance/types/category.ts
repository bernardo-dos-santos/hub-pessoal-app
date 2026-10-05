import {
  type AccountType,
  type ClassificationConfidence,
  type FinanceScope,
  type TransactionKind,
  type TransactionSource,
} from './finance';

export type CategoryType = 'income' | 'expense' | 'transfer' | 'review';

export type Category = {
  id: string;
  name: string;
  type?: CategoryType;
  scope?: FinanceScope;
  color?: string;
  icon?: string;
  isDefault: boolean;
  isSpecial: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  aliases?: string[];
};

export type CategoryRule = {
  id: string;
  name: string;
  keyword: string;
  normalizedKeyword: string;
  category: string;
  categoryId?: string;
  kind?: TransactionKind;
  scope?: FinanceScope;
  accountType?: AccountType;
  source?: TransactionSource;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CategoryRuleMatch = {
  ruleId: string;
  ruleKeyword: string;
  category: string;
  kind?: TransactionKind;
  confidence: ClassificationConfidence;
  reason: string;
};
