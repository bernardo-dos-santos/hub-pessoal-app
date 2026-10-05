/**
 * jarvis/inbox.js — escrita na caixa de entrada do Jarvis (`jarvis.inbox`).
 *
 * Estava copiada em três arquivos (self.js, tasks.js e commands.js), cada uma
 * com uma variação: uma gerava id com prefixo, outra cravava o teto em 100 sem
 * constante, uma terceira não suportava `undo`. Item sem `undo` é o que faz o
 * botão de desfazer sumir do painel, então a variação não era cosmética.
 *
 * O formato do item é o mesmo que o frontend lê em `src/core/jarvis/
 * jarvisInbox.ts` — duplicado lá pela razão de sempre: o servidor é JS puro e
 * não importa TS do frontend. Mudou aqui, mude lá.
 */

import { kvStore } from '../db.js';
import { kv } from './context.js';

const KEY = 'jarvis.inbox';

/** Teto de itens guardados — a inbox é um fluxo, não um arquivo histórico. */
export const MAX_INBOX = 100;

export function genInboxId() {
  return `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} input
 * @param {'observation'|'action_taken'|'question'|'task_result'} input.kind
 * @param {string} input.title
 * @param {string} [input.body]
 * @param {object} [input.undo]        Payload de desfazer (só em action_taken)
 * @param {string[]} [input.relatedKeys]
 */
export function addInboxItem({ kind, title, body, undo, relatedKeys }) {
  const items = kv(KEY) ?? [];
  const item = {
    id: genInboxId(),
    kind,
    title,
    body: body ?? null,
    createdAt: new Date().toISOString(),
    readAt: null,
    undo: undo ?? undefined,
    relatedKeys: relatedKeys ?? undefined,
  };
  kvStore.set(KEY, JSON.stringify([item, ...items].slice(0, MAX_INBOX)));
  return item;
}
