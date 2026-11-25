/**
 * userContext.js — de quem é o dado que está sendo lido ou escrito agora.
 *
 * O Hub nasceu de um usuário só, e ~25 arquivos do servidor leem o banco sem
 * dizer de quem (`kvStore.get('finance.transactions')`). Em vez de passar um
 * userId por todas essas assinaturas, a requisição abre um contexto
 * (AsyncLocalStorage) e o acesso ao banco lê o usuário dele — ele atravessa
 * await, callbacks e tarefas disparadas de dentro da requisição.
 *
 * Sem contexto, `currentUserId()` LANÇA. É de propósito: o erro aparece no
 * primeiro teste em vez de um timer ou script novo ler, em silêncio, os dados
 * de outra pessoa. Quem roda fora de requisição (scheduler, boot, scripts)
 * declara para quem roda com `runAsUser`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/** O dono do servidor: todos os dados de antes do multiusuário são dele. */
export const OWNER_ID = 1;

const storage = new AsyncLocalStorage();

export function runAsUser(userId, fn) {
  if (!Number.isInteger(userId) || userId < 1) throw new Error(`runAsUser: userId inválido (${userId})`);
  return storage.run({ userId }, fn);
}

/**
 * Para scripts e testes que rodam de cima a baixo (top-level await), onde
 * envolver tudo num callback não cabe: vale para o resto da execução atual e
 * o que ela disparar. Nunca use dentro do servidor — lá o contexto vem da
 * requisição ou de um runAsUser explícito.
 */
export function enterUserContext(userId) {
  if (!Number.isInteger(userId) || userId < 1) throw new Error(`enterUserContext: userId inválido (${userId})`);
  storage.enterWith({ userId });
}

export function currentUserId() {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('Acesso a dado de usuário fora de um contexto de usuário — envolva a chamada em runAsUser().');
  }
  return ctx.userId;
}
