export type InvoiceStatus = 'open' | 'closed' | 'paid';

export type Invoice = {
  id: string;
  cardId: string;
  month: number;
  year: number;
  closingDate?: string;
  dueDate?: string;
  total: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
};
