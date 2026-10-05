export type CardType = 'credit' | 'debit' | 'virtual';

export type Card = {
  id: string;
  name: string;
  accountId?: string;
  type: CardType;
  limit?: number;
  closingDay?: number;
  dueDay?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
