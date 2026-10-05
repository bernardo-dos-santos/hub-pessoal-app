// server/db.js
// Banco SQLite local via node:sqlite (built-in no Node 22.5+/24).
// Isolado aqui para facilitar troca por better-sqlite3 se necessário.

import { DatabaseSync } from 'node:sqlite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../hub.db');

const db = new DatabaseSync(DB_PATH);

// Schema: kv_store espelha o localStorage (chave → JSON).
db.exec(`
  CREATE TABLE IF NOT EXISTS kv_store (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS material_content (
    material_id  TEXT PRIMARY KEY,
    text         TEXT NOT NULL,
    extracted_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS secrets (
    name  TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS project_files (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL,
    front_id     TEXT,
    file_name    TEXT NOT NULL,
    mime_type    TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );
`);

const stmtGetAll  = db.prepare('SELECT key, value FROM kv_store');
const stmtGet     = db.prepare('SELECT value FROM kv_store WHERE key = ?');
const stmtSet     = db.prepare(
  'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);
const stmtDelete  = db.prepare('DELETE FROM kv_store WHERE key = ?');
const stmtCount   = db.prepare('SELECT COUNT(*) AS n FROM kv_store');

export const kvStore = {
  /** Retorna { key: rawJsonString } de todas as chaves. */
  getAll() {
    const rows = stmtGetAll.all();
    const result = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  },

  get(key) {
    const row = stmtGet.get(key);
    return row ? row.value : null;
  },

  set(key, value) {
    stmtSet.run(key, value);
  },

  delete(key) {
    stmtDelete.run(key);
  },

  count() {
    return stmtCount.get().n;
  },
};

const stmtGetSecret    = db.prepare('SELECT value FROM secrets WHERE name = ?');
const stmtSetSecret    = db.prepare(
  'INSERT INTO secrets (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value',
);
const stmtDeleteSecret = db.prepare('DELETE FROM secrets WHERE name = ?');

/**
 * Segredos por usuário (chaves de API, credenciais). Tabela separada do
 * kv_store de propósito: o kv_store inteiro é servido ao cliente por
 * GET /api/store, então nada que não possa chegar ao browser pode morar lá.
 * Os valores aqui são ciphertext de server/crypto.js — quem lê decifra.
 */
export const secrets = {
  get(name) {
    const row = stmtGetSecret.get(name);
    return row ? row.value : null;
  },
  set(name, value) {
    stmtSetSecret.run(name, value);
  },
  delete(name) {
    stmtDeleteSecret.run(name);
  },
};

const stmtGetMaterial = db.prepare('SELECT text, extracted_at FROM material_content WHERE material_id = ?');
const stmtSetMaterial = db.prepare(
  'INSERT INTO material_content (material_id, text, extracted_at) VALUES (?, ?, ?) ON CONFLICT(material_id) DO UPDATE SET text = excluded.text, extracted_at = excluded.extracted_at',
);

export const materialContent = {
  get(materialId) {
    return stmtGetMaterial.get(materialId) ?? null;
  },
  set(materialId, text) {
    stmtSetMaterial.run(materialId, text, new Date().toISOString());
  },
};

const stmtListProjectFiles = db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at DESC');
const stmtGetProjectFile = db.prepare('SELECT * FROM project_files WHERE id = ?');
const stmtInsertProjectFile = db.prepare(
  'INSERT INTO project_files (id, project_id, front_id, file_name, mime_type, size_bytes, storage_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);
const stmtDeleteProjectFile = db.prepare('DELETE FROM project_files WHERE id = ?');

// Metadado dos arquivos anexados a um projeto. Os bytes ficam em disco
// (uploads/projects/), não aqui — esta tabela só indexa pra listar/baixar/apagar.
export const projectFiles = {
  listByProject(projectId) {
    return stmtListProjectFiles.all(projectId);
  },
  get(id) {
    return stmtGetProjectFile.get(id) ?? null;
  },
  insert({ id, projectId, frontId, fileName, mimeType, sizeBytes, storagePath, createdAt }) {
    stmtInsertProjectFile.run(id, projectId, frontId ?? null, fileName, mimeType, sizeBytes, storagePath, createdAt);
  },
  delete(id) {
    stmtDeleteProjectFile.run(id);
  },
};

export { DB_PATH };
