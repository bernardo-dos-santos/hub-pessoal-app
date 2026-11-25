/**
 * hubDb.js — leitura do kv_store do DONO por scripts que abrem o hub.db direto
 * (sem subir o servidor nem passar por server/db.js).
 *
 * Existe porque cada script tinha a própria cópia de `SELECT value FROM
 * kv_store WHERE key = ?`. Com o multiusuário a chave passou a ser
 * (user_id, key), e essa consulta devolveria a linha de um usuário qualquer.
 * Aceita os dois formatos do banco: um script pode rodar antes de o servidor
 * migrar (o notebook de dev, por exemplo) — sem a coluna, todo dado é do dono.
 *
 * Só o dono, por enquanto: na F3 os jobs passam a rodar por usuário.
 */

import { DatabaseSync } from 'node:sqlite';
import { OWNER_ID } from '../../server/userContext.js';

/**
 * Opens hub.db for a script. Always through here: without a busy timeout, the
 * script's lock makes the server's writes fail on the spot (or the script's
 * own read fail while the server writes) — see server/db.js.
 */
export function openHubDb(path, options = {}) {
  const db = new DatabaseSync(path, options);
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function parse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

/** @param {import('node:sqlite').DatabaseSync} db */
export function ownerKv(db) {
  const multiUser = db.prepare('PRAGMA table_info(kv_store)').all().some((c) => c.name === 'user_id');
  const where = multiUser ? `user_id = ${OWNER_ID} AND` : '';
  const getStmt = db.prepare(`SELECT value FROM kv_store WHERE ${where} key = ?`);
  const likeStmt = db.prepare(`SELECT key, value FROM kv_store WHERE ${where} key LIKE ?`);

  return {
    /** Valor já parseado, ou null se a chave não existe. */
    get(key) {
      const row = getStmt.get(key);
      return row ? parse(row.value) : null;
    },
    /** { key: valor } de todas as chaves que começam com `prefix`. */
    getByPrefix(prefix) {
      const result = {};
      for (const row of likeStmt.all(`${prefix}%`)) result[row.key] = parse(row.value);
      return result;
    },
  };
}
