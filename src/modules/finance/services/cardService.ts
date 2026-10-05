import { storageAdapter } from '../../../core/storage/storage.adapter';
import { type Card } from '../types/card';

const cardsStorageKey = 'finance.cards';
const createdAt = '2026-05-20T00:00:00.000Z';

const mockCards: Card[] = [
  {
    id: 'nubank-cartao-principal',
    name: 'Nubank Cartão',
    accountId: 'nubank-cartao',
    type: 'credit',
    closingDay: 5,
    dueDay: 12,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
];

export const cardService = {
  listCards(): Card[] {
    return storageAdapter.getItem<Card[]>(cardsStorageKey) ?? mockCards;
  },

  getCardById(id: string): Card | null {
    return this.listCards().find((card) => card.id === id) ?? null;
  },

  updateCard(id: string, patch: Partial<Pick<Card, 'limit' | 'closingDay' | 'dueDay' | 'accountId' | 'isActive'>>): void {
    const cards = this.listCards();
    const idx = cards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    cards[idx] = { ...cards[idx], ...patch, updatedAt: new Date().toISOString() };
    storageAdapter.setItem(cardsStorageKey, cards);
  },
};
