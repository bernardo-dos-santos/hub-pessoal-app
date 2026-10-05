import { type AccountType, type FinanceScope } from './finance';

export type Account = {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  scope: FinanceScope;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
