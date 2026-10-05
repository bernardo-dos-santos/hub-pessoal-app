import { storageAdapter } from '../../../core/storage/storage.adapter';
import { defaultAccounts } from '../data/defaultAccounts';
import { type Account } from '../types/account';

const KEY_ACCOUNT_MAP = 'finance.pluggyAccountMap';

/**
 * De-para entre a conta na Pluggy e a conta canônica do Hub.
 *
 * Existe porque a Pluggy tem vocabulário próprio: o id da conta é um UUID dela,
 * e `connector.name` vem como "MeuPluggy" em TODAS as conexões (não é o nome do
 * banco). Sem tradução, a mesma transação vinda da Pluggy e do sync por e-mail
 * fica com `accountId`/`institution`/`scope` diferentes e a deduplicação não
 * consegue casar as duas — o Hub duplicaria tudo que já tinha importado.
 *
 * O mapa é por usuário (fica no storage, não no código): os ids de conta da
 * Pluggy são de uma conexão específica e não fazem sentido pra outra pessoa.
 */
export type PluggyAccountMap = Record<string, string>;

export function getPluggyAccountMap(): PluggyAccountMap {
  return storageAdapter.getItem<PluggyAccountMap>(KEY_ACCOUNT_MAP) ?? {};
}

export function setPluggyAccountMapping(pluggyAccountId: string, hubAccountId: string): PluggyAccountMap {
  const next = { ...getPluggyAccountMap(), [pluggyAccountId]: hubAccountId };
  storageAdapter.setItem(KEY_ACCOUNT_MAP, next);
  return next;
}

export function clearPluggyAccountMapping(pluggyAccountId: string): PluggyAccountMap {
  const next = { ...getPluggyAccountMap() };
  delete next[pluggyAccountId];
  storageAdapter.setItem(KEY_ACCOUNT_MAP, next);
  return next;
}

/** Conta canônica do Hub pra uma conta da Pluggy, ou null se ainda não mapeada. */
export function resolveHubAccount(pluggyAccountId: string): Account | null {
  const hubAccountId = getPluggyAccountMap()[pluggyAccountId];
  if (!hubAccountId) return null;
  return defaultAccounts.find((account) => account.id === hubAccountId) ?? null;
}

export function listMappableHubAccounts(): Account[] {
  return defaultAccounts.filter((account) => account.isActive);
}

export const pluggyAccountMappingService = {
  getPluggyAccountMap,
  setPluggyAccountMapping,
  clearPluggyAccountMapping,
  resolveHubAccount,
  listMappableHubAccounts,
};
