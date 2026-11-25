import { type Account } from '../types/account';

/**
 * The owner's accounts from single-user times, when this list WAS the account
 * registry. Only `accountService` reads it, to seed the owner's
 * `finance.accounts` once; everyone else starts with the cash account.
 */
const createdAt = '2026-05-20T00:00:00.000Z';

export const ownerLegacyAccounts: Account[] = [
  {
    id: 'nubank-conta',
    name: 'Nubank Conta',
    institution: 'Nubank',
    type: 'checking',
    scope: 'pessoal',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'nubank-cartao',
    name: 'Nubank Cartão',
    institution: 'Nubank',
    type: 'credit_card',
    scope: 'pessoal',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'c6-empresa',
    name: 'C6 Empresa',
    institution: 'C6 Bank',
    type: 'business_checking',
    scope: 'empresa',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'c6-cartao',
    name: 'C6 Cartão',
    institution: 'C6 Bank',
    type: 'credit_card',
    scope: 'empresa',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'xp-conta',
    name: 'XP Conta',
    institution: 'XP',
    type: 'checking',
    scope: 'pessoal',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: 'dinheiro',
    name: 'Dinheiro',
    institution: 'Carteira',
    type: 'cash',
    scope: 'pessoal',
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  },
];
