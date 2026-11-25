import { getSession } from '../../../core/session/session';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { type Card } from '../types/card';
import { accountService } from './accountService';

const cardsStorageKey = 'finance.cards';
const createdAt = '2026-05-20T00:00:00.000Z';

/** The owner's card from single-user times — seeds only the owner; others start without cards. */
const ownerLegacyCards: Card[] = [
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
    return storageAdapter.getItem<Card[]>(cardsStorageKey) ?? (getSession().isOwner ? ownerLegacyCards : []);
  },

  getCardById(id: string): Card | null {
    return this.listCards().find((card) => card.id === id) ?? null;
  },

  /**
   * A credit card for anyone — until now only the owner had one (seeded from
   * single-user times) and nobody else could make one. It gets its own account,
   * named like the card, so an imported bill with that account name lands on it.
   */
  createCard(input: Pick<Card, 'name' | 'limit' | 'closingDay' | 'dueDay'>): Card {
    const now = new Date().toISOString();
    const account = accountService.createAccount({ name: input.name, institution: '', type: 'credit_card', scope: 'pessoal' });
    const card: Card = { ...input, id: generateId('card'), accountId: account.id, type: 'credit', isActive: true, createdAt: now, updatedAt: now };
    storageAdapter.setItem(cardsStorageKey, [...this.listCards(), card]);
    return card;
  },

  updateCard(id: string, patch: Partial<Pick<Card, 'limit' | 'closingDay' | 'dueDay' | 'accountId' | 'isActive'>>): void {
    const cards = this.listCards();
    const idx = cards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    cards[idx] = { ...cards[idx], ...patch, updatedAt: new Date().toISOString() };
    storageAdapter.setItem(cardsStorageKey, cards);
  },
};
