// server/db.js
// Banco SQLite local via node:sqlite (built-in no Node 22.5+/24).
// Isolado aqui para facilitar troca por better-sqlite3 se necessário.
//
// Todo dado de usuário é por usuário: cada leitura e escrita filtra pelo
// `currentUserId()` do contexto da requisição (server/userContext.js). Sem
// contexto, o acesso lança — nunca cai num usuário "padrão".

import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentUserId, OWNER_ID } from './userContext.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// HUB_DB_PATH existe para os testes de isolamento rodarem num banco descartável.
const DB_PATH = process.env.HUB_DB_PATH ? resolve(process.env.HUB_DB_PATH) : resolve(__dirname, '../hub.db');

const db = new DatabaseSync(DB_PATH);
// Scheduled scripts open this file too (scripts/lib/hubDb.js). Without these
// two, a script merely reading it made any server write fail at once with
// "database is locked" — on 2026-11-16 that killed the boot after a power cut,
// when every overdue job started together. WAL lets readers and the writer
// coexist; busy_timeout makes a write wait for a lock instead of throwing.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

/**
 * Leva um banco de usuário único para o formato multiusuário: todo dado que
 * já existe passa a ser do dono (OWNER_ID). Idempotente — sem tabela no
 * formato antigo, não faz nada.
 *
 * Antes de tocar em qualquer tabela, grava uma cópia completa ao lado do banco
 * (`VACUUM INTO`, que é seguro com o banco aberto). Este código roda sozinho
 * no servidor de produção no primeiro boot depois do deploy, então a cópia é
 * a única volta possível se algo der errado. A troca em si é uma transação só:
 * ou migra tudo, ou nada.
 *
 * Devolve o caminho da cópia, ou null quando não havia o que migrar.
 */
export function migrateToMultiUser() {
  const legacy = ['kv_store', 'material_content', 'secrets', 'project_files'].filter((table) => {
    const cols = tableColumns(table);
    return cols.length > 0 && !cols.includes('user_id');
  });
  if (legacy.length === 0) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `${DB_PATH}.pre-multiuser-${stamp}`;
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

  db.exec('BEGIN');
  try {
    if (legacy.includes('kv_store')) {
      db.exec(`
        CREATE TABLE kv_store_mu (
          user_id INTEGER NOT NULL,
          key     TEXT NOT NULL,
          value   TEXT NOT NULL,
          PRIMARY KEY (user_id, key)
        );
        INSERT INTO kv_store_mu (user_id, key, value) SELECT ${OWNER_ID}, key, value FROM kv_store;
        DROP TABLE kv_store;
        ALTER TABLE kv_store_mu RENAME TO kv_store;
      `);
    }
    if (legacy.includes('material_content')) {
      db.exec(`
        CREATE TABLE material_content_mu (
          user_id      INTEGER NOT NULL,
          material_id  TEXT NOT NULL,
          text         TEXT NOT NULL,
          extracted_at TEXT NOT NULL,
          PRIMARY KEY (user_id, material_id)
        );
        INSERT INTO material_content_mu (user_id, material_id, text, extracted_at)
          SELECT ${OWNER_ID}, material_id, text, extracted_at FROM material_content;
        DROP TABLE material_content;
        ALTER TABLE material_content_mu RENAME TO material_content;
      `);
    }
    if (legacy.includes('secrets')) {
      db.exec(`
        CREATE TABLE secrets_mu (
          user_id INTEGER NOT NULL,
          name    TEXT NOT NULL,
          value   TEXT NOT NULL,
          PRIMARY KEY (user_id, name)
        );
        INSERT INTO secrets_mu (user_id, name, value) SELECT ${OWNER_ID}, name, value FROM secrets;
        DROP TABLE secrets;
        ALTER TABLE secrets_mu RENAME TO secrets;
      `);
    }
    if (legacy.includes('project_files')) {
      db.exec(`ALTER TABLE project_files ADD COLUMN user_id INTEGER NOT NULL DEFAULT ${OWNER_ID}`);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log(`[db] Banco migrado para multiusuário (${legacy.join(', ')}); cópia de antes em ${backupPath}`);
  return backupPath;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT UNIQUE,
    tailscale_login TEXT UNIQUE,
    is_admin        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
  );
`);
db.prepare('INSERT OR IGNORE INTO users (id, name, is_admin, created_at) VALUES (?, ?, 1, ?)')
  .run(OWNER_ID, 'Bernardo', new Date().toISOString());

// F2: first access, chosen modules and the admin panel's bookkeeping.
// `modules` is a JSON array of module ids; NULL means every module.
{
  const existing = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
  for (const column of ['modules', 'onboarded_at', 'disabled_at', 'last_seen_at']) {
    if (!existing.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT`);
  }
  // The owner already uses the Hub — first access is for people arriving now.
  if (!existing.has('onboarded_at')) {
    db.prepare('UPDATE users SET onboarded_at = created_at WHERE id = ?').run(OWNER_ID);
  }
}

migrateToMultiUser();

// Schema de um banco novo — já nasce no formato multiusuário.
db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    user_id INTEGER NOT NULL,
    key     TEXT NOT NULL,
    value   TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  CREATE TABLE IF NOT EXISTS material_content (
    user_id      INTEGER NOT NULL,
    material_id  TEXT NOT NULL,
    text         TEXT NOT NULL,
    extracted_at TEXT NOT NULL,
    PRIMARY KEY (user_id, material_id)
  );
  CREATE TABLE IF NOT EXISTS secrets (
    user_id INTEGER NOT NULL,
    name    TEXT NOT NULL,
    value   TEXT NOT NULL,
    PRIMARY KEY (user_id, name)
  );
  CREATE TABLE IF NOT EXISTS project_files (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL,
    front_id     TEXT,
    file_name    TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    user_id      INTEGER NOT NULL DEFAULT ${OWNER_ID}
  );
`);

// ─── Usuários ─────────────────────────────────────────────────────────────────

const stmtUserGet = db.prepare('SELECT * FROM users WHERE id = ?');
const stmtUserByTailscale = db.prepare('SELECT * FROM users WHERE tailscale_login = ?');
const stmtUserSetTailscale = db.prepare('UPDATE users SET tailscale_login = ? WHERE id = ?');
const stmtUserList = db.prepare('SELECT * FROM users ORDER BY id');
const stmtUserInsert = db.prepare('INSERT INTO users (name, email, is_admin, created_at) VALUES (?, ?, 0, ?)');
const stmtUserSeen = db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?');
const stmtUserKeyCounts = db.prepare('SELECT user_id, COUNT(*) AS keys FROM kv_store GROUP BY user_id');
const stmtUserSecretNames = db.prepare('SELECT user_id, name FROM secrets');

/** Columns an update may touch — the rest (id, is_admin, created_at) never change through it. */
const USER_UPDATABLE = ['name', 'email', 'tailscale_login', 'modules', 'onboarded_at', 'disabled_at'];

export const users = {
  get(id) {
    return stmtUserGet.get(id) ?? null;
  },
  findByTailscaleLogin(login) {
    return stmtUserByTailscale.get(login) ?? null;
  },
  setTailscaleLogin(id, login) {
    stmtUserSetTailscale.run(login, id);
  },
  list() {
    return stmtUserList.all();
  },
  create({ name, email = null }) {
    const { lastInsertRowid } = stmtUserInsert.run(name, email, new Date().toISOString());
    return this.get(Number(lastInsertRowid));
  },
  update(id, fields) {
    const columns = Object.keys(fields).filter((c) => USER_UPDATABLE.includes(c));
    if (columns.length === 0) return this.get(id);
    db.prepare(`UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...columns.map((c) => fields[c]), id);
    return this.get(id);
  },
  markSeen(id, iso = new Date().toISOString()) {
    stmtUserSeen.run(iso, id);
  },
  /** Which secrets each user has stored, for the admin panel — names only, never values. */
  secretNames() {
    const byUser = {};
    for (const { user_id: id, name } of stmtUserSecretNames.all()) (byUser[id] ??= []).push(name);
    return byUser;
  },
  /** Key count per user, for the admin panel — counts only, never values. */
  keyCounts() {
    return Object.fromEntries(stmtUserKeyCounts.all().map((r) => [r.user_id, r.keys]));
  },
};

// ─── Módulos em manutenção (global — vale para todos os usuários) ─────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS module_maintenance (
    module_id TEXT PRIMARY KEY,
    message   TEXT NOT NULL,
    since     TEXT NOT NULL
  );
`);

const stmtMaintenanceList = db.prepare('SELECT module_id AS moduleId, message, since FROM module_maintenance ORDER BY module_id');
const stmtMaintenanceSet = db.prepare(
  'INSERT INTO module_maintenance (module_id, message, since) VALUES (?, ?, ?) ON CONFLICT(module_id) DO UPDATE SET message = excluded.message',
);
const stmtMaintenanceClear = db.prepare('DELETE FROM module_maintenance WHERE module_id = ?');

export const maintenance = {
  list() {
    return stmtMaintenanceList.all();
  },
  set(moduleId, message) {
    stmtMaintenanceSet.run(moduleId, message, new Date().toISOString());
  },
  clear(moduleId) {
    stmtMaintenanceClear.run(moduleId);
  },
};

// ─── Device certificates (F4, public port) ────────────────────────────────────
// Global like `users`: one row per device certificate Cloudflare signed. On the
// public port the only proof of who someone is, is which certificate their
// device presented (identity.js → resolvePublicIdentity). Revoking keeps the
// row, so the panel can still show whose device it was.
db.exec(`
  CREATE TABLE IF NOT EXISTS client_certs (
    fingerprint TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    label       TEXT NOT NULL,
    not_after   TEXT,
    created_at  TEXT NOT NULL,
    revoked_at  TEXT
  );
`);
// cloudflare_id: the certificate's id at Cloudflare when the panel issued it
// through the API (server/deviceCerts.js) — what revoking there needs. NULL
// for certificates signed by hand.
if (!db.prepare('PRAGMA table_info(client_certs)').all().some((c) => c.name === 'cloudflare_id')) {
  db.exec('ALTER TABLE client_certs ADD COLUMN cloudflare_id TEXT');
}

const stmtCertGet = db.prepare('SELECT * FROM client_certs WHERE fingerprint = ?');
const stmtCertList = db.prepare('SELECT * FROM client_certs ORDER BY created_at');
const stmtCertAdd = db.prepare(
  'INSERT INTO client_certs (fingerprint, user_id, label, not_after, created_at, cloudflare_id) VALUES (?, ?, ?, ?, ?, ?)',
);
const stmtCertRevoke = db.prepare('UPDATE client_certs SET revoked_at = ? WHERE fingerprint = ? AND revoked_at IS NULL');

/** SHA-256 fingerprints arrive as hex in any case, with or without colons. */
export function normalizeFingerprint(raw) {
  return String(raw ?? '').replace(/[:\s]/g, '').toLowerCase();
}

export const clientCerts = {
  /** The certificate's row while it isn't revoked; null otherwise. */
  findActive(fingerprint) {
    const row = stmtCertGet.get(normalizeFingerprint(fingerprint));
    return row && !row.revoked_at ? row : null;
  },
  get(fingerprint) {
    return stmtCertGet.get(normalizeFingerprint(fingerprint)) ?? null;
  },
  list() {
    return stmtCertList.all();
  },
  add({ fingerprint, userId, label, notAfter = null, cloudflareId = null }) {
    stmtCertAdd.run(normalizeFingerprint(fingerprint), userId, label, notAfter, new Date().toISOString(), cloudflareId);
    return this.get(fingerprint);
  },
  revoke(fingerprint) {
    return stmtCertRevoke.run(new Date().toISOString(), normalizeFingerprint(fingerprint)).changes > 0;
  },
};

// ─── kv_store ─────────────────────────────────────────────────────────────────

const stmtGetAll  = db.prepare('SELECT key, value FROM kv_store WHERE user_id = ?');
const stmtGet     = db.prepare('SELECT value FROM kv_store WHERE user_id = ? AND key = ?');
const stmtSet     = db.prepare(
  'INSERT INTO kv_store (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value',
);
const stmtDelete  = db.prepare('DELETE FROM kv_store WHERE user_id = ? AND key = ?');
const stmtCount   = db.prepare('SELECT COUNT(*) AS n FROM kv_store');

export const kvStore = {
  /** Retorna { key: rawJsonString } de todas as chaves do usuário atual. */
  getAll() {
    const rows = stmtGetAll.all(currentUserId());
    const result = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  },

  get(key) {
    const row = stmtGet.get(currentUserId(), key);
    return row ? row.value : null;
  },

  set(key, value) {
    stmtSet.run(currentUserId(), key, value);
  },

  delete(key) {
    stmtDelete.run(currentUserId(), key);
  },

  /** Total de chaves de todos os usuários — diagnóstico (health, log de boot), não dado. */
  count() {
    return stmtCount.get().n;
  },
};

// ─── secrets ──────────────────────────────────────────────────────────────────

const stmtGetSecret    = db.prepare('SELECT value FROM secrets WHERE user_id = ? AND name = ?');
const stmtSetSecret    = db.prepare(
  'INSERT INTO secrets (user_id, name, value) VALUES (?, ?, ?) ON CONFLICT(user_id, name) DO UPDATE SET value = excluded.value',
);
const stmtDeleteSecret = db.prepare('DELETE FROM secrets WHERE user_id = ? AND name = ?');

// study.weeklyPlan / study.routine became planner.* long ago; the browser copied
// them over but never deleted the old rows, and scripts kept reading the stale
// June plan from them. Move whatever wasn't copied, then drop the old keys.
for (const [oldKey, newKey] of [['study.weeklyPlan', 'planner.weeklyPlan'], ['study.routine', 'planner.routine']]) {
  db.prepare(`UPDATE kv_store SET key = ? WHERE key = ? AND NOT EXISTS
    (SELECT 1 FROM kv_store k2 WHERE k2.user_id = kv_store.user_id AND k2.key = ?)`).run(newKey, oldKey, newKey);
  db.prepare('DELETE FROM kv_store WHERE key = ?').run(oldKey);
}

// The Pluggy integration was removed (2026-11). Its credentials have no reader
// left, and a bank credential nobody uses is only something that can leak.
db.exec("DELETE FROM secrets WHERE name LIKE 'pluggy.%'");

/**
 * Segredos por usuário (chaves de API, credenciais). Tabela separada do
 * kv_store de propósito: o kv_store inteiro é servido ao cliente por
 * GET /api/store, então nada que não possa chegar ao browser pode morar lá.
 * Os valores aqui são ciphertext de server/crypto.js — quem lê decifra.
 */
export const secrets = {
  get(name) {
    const row = stmtGetSecret.get(currentUserId(), name);
    return row ? row.value : null;
  },
  set(name, value) {
    stmtSetSecret.run(currentUserId(), name, value);
  },
  delete(name) {
    stmtDeleteSecret.run(currentUserId(), name);
  },
};

// ─── material_content ─────────────────────────────────────────────────────────

const stmtGetMaterial = db.prepare('SELECT text, extracted_at FROM material_content WHERE user_id = ? AND material_id = ?');
const stmtSetMaterial = db.prepare(
  'INSERT INTO material_content (user_id, material_id, text, extracted_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, material_id) DO UPDATE SET text = excluded.text, extracted_at = excluded.extracted_at',
);

export const materialContent = {
  get(materialId) {
    return stmtGetMaterial.get(currentUserId(), materialId) ?? null;
  },
  set(materialId, text) {
    stmtSetMaterial.run(currentUserId(), materialId, text, new Date().toISOString());
  },
};

// ─── project_files ────────────────────────────────────────────────────────────

const stmtListProjectFiles = db.prepare('SELECT * FROM project_files WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC');
const stmtGetProjectFile = db.prepare('SELECT * FROM project_files WHERE user_id = ? AND id = ?');
const stmtInsertProjectFile = db.prepare(
  'INSERT INTO project_files (id, project_id, front_id, file_name, mime_type, size_bytes, storage_path, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
);
const stmtDeleteProjectFile = db.prepare('DELETE FROM project_files WHERE user_id = ? AND id = ?');

// Metadado dos arquivos anexados a um projeto. Os bytes ficam em disco
// (uploads/), não aqui — esta tabela só indexa pra listar/baixar/apagar, e é
// ela que decide de quem o arquivo é: o caminho em disco não autoriza nada.
export const projectFiles = {
  listByProject(projectId) {
    return stmtListProjectFiles.all(currentUserId(), projectId);
  },
  get(id) {
    return stmtGetProjectFile.get(currentUserId(), id) ?? null;
  },
  insert({ id, projectId, frontId, fileName, mimeType, sizeBytes, storagePath, createdAt }) {
    stmtInsertProjectFile.run(id, projectId, frontId ?? null, fileName, mimeType, sizeBytes, storagePath, createdAt, currentUserId());
  },
  delete(id) {
    stmtDeleteProjectFile.run(currentUserId(), id);
  },
};

export { DB_PATH };
