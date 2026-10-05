import {
  type AccountType,
  type ClassificationConfidence,
  type FinanceScope,
  type TransactionKind,
  type TransactionMethod,
  type TransactionSource,
} from './finance';

export type Transaction = {
  id: string;
  date: string;
  description: string;
  originalDescription?: string;
  amount: number;
  category: string;
  categoryId?: string;
  accountId?: string;
  accountName?: string;
  institution?: string;
  scope: FinanceScope;
  accountType: AccountType;
  method: TransactionMethod;
  kind: TransactionKind;
  source: TransactionSource;
  notes?: string;
  manualCategory: boolean;
  linkedTransferId?: string;
  needsReview: boolean;
  classificationConfidence: ClassificationConfidence;
  classificationReason: string;
  reviewedAt?: string;
  reviewedBy?: 'review_page' | 'transactions_page' | 'mark_reviewed' | 'quick_action' | 'rule_application' | 'reimbursement_pairing';
  reimbursementPairId?: string;
  reimbursementRole?: 'original' | 'refund';
  reimbursementStatus?: 'matched' | 'unmatched' | 'ignored';
  reimbursementMatchedAt?: string;
  installmentCount?: number;
  installmentValue?: number;
  createdAt: string;
  updatedAt: string;
};
