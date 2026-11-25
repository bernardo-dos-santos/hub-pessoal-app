import { getSession } from '../../../core/session/session';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { ownerLegacyAccounts } from '../data/ownerLegacyAccounts';
import { type Account } from '../types/account';

const accountsStorageKey = 'finance.accounts';

/** Every user has cash; the id is shared so text-based detection ("dinheiro") keeps finding it. */
export const CASH_ACCOUNT_ID = 'dinheiro';

function cashAccount(now: string): Account {
  return { id: CASH_ACCOUNT_ID, name: 'Dinheiro', institution: 'Carteira', type: 'cash', scope: 'pessoal', isActive: true, createdAt: now, updatedAt: now };
}

/**
 * Accounts are per user. Until multi-user they were a constant in the code —
 * the owner's banks — so the first read seeds the owner with that list and
 * anyone else with just cash; from then on the stored list is the truth.
 */
function readAccounts(): Account[] {
  const stored = storageAdapter.getItem<Account[]>(accountsStorageKey);
  if (stored) return stored;
  const seed = getSession().isOwner ? ownerLegacyAccounts : [cashAccount(new Date().toISOString())];
  storageAdapter.setItem(accountsStorageKey, seed);
  return seed;
}

export type CreateAccountInput = Pick<Account, 'name' | 'institution' | 'type' | 'scope'>;

export const accountService = {
  listAccounts(): Account[] {
    return readAccounts();
  },

  listActiveAccounts(): Account[] {
    return readAccounts().filter((account) => account.isActive);
  },

  getAccount(id: string): Account | null {
    return readAccounts().find((account) => account.id === id) ?? null;
  },

  createAccount(input: CreateAccountInput): Account {
    const now = new Date().toISOString();
    const account: Account = { ...input, id: generateId('account'), isActive: true, createdAt: now, updatedAt: now };
    storageAdapter.setItem(accountsStorageKey, [...readAccounts(), account]);
    return account;
  },
};
