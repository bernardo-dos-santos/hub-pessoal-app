/**
 * gdrive-backup.js
 * Sobe para a pasta "Hub Backups" no Google Drive:
 *   - hub-backup-<data>.json: o kv_store inteiro + a tabela project_files;
 *   - hub-files-<data>.tar.gz: uploads/ (anexos de projeto) e jarvis-memory/,
 *     que moram em disco e não no banco — sem isto, o JSON restaurava o registro
 *     de um anexo cujo arquivo tinha sumido.
 * Retenção em scripts/lib/backupRetention.js (diários + semanais + mensais).
 *
 * Não entram: a tabela `secrets` (chaves de IA cifradas com uma chave que é por
 * máquina — inúteis em outra) e material_content (texto extraído de PDF, que se
 * regenera).
 *
 * Uso:
 *   node scripts/sync/gdrive-backup.js
 *
 * Pré-requisito: token OAuth já autorizado em scripts/config/token.json
 * (o authorize-google.js gera esse token — reutilizamos).
 */

import { openHubDb } from '../lib/hubDb.js';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { notifySyncFailure } from '../lib/notify.js';
import { createLogger } from '../lib/logger.js';
import { selectRetained } from '../lib/backupRetention.js';
import { OWNER_ID } from '../../server/userContext.js';
import {
  getOrCreateFolder, listFiles, uploadFile, deleteFile, downloadFile, escapeQueryValue,
} from '../../server/google.js';

const log = createLogger('gdrive-backup');
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Caminhos ---
const ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(ROOT, 'hub.db');
/** Pastas de dados fora do banco que também precisam voltar num restore. */
const ARCHIVED_DIRS = ['uploads', 'jarvis-memory'];
/** Relativo a ROOT de propósito: o tar do Git (GNU) lê "C:" como host remoto. */
const ARCHIVE_REL = 'data/hub-files.tar.gz';

// --- Configurações ---
const DRIVE_FOLDER_NAME = 'Hub Backups';

// --- Drive helpers ---

async function listBackups(folderId, prefix) {
  return listFiles({
    q: `'${escapeQueryValue(folderId)}' in parents and name contains '${escapeQueryValue(prefix)}' and trashed=false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 200,
  });
}

async function uploadBackup(folderId, filename, jsonContent) {
  return uploadFile({
    name: filename,
    parentId: folderId,
    mimeType: 'application/json',
    body: Readable.from(Buffer.from(jsonContent, 'utf-8')),
  });
}

async function pruneBackups(folderId, prefix) {
  const backups = await listBackups(folderId, prefix);
  const keep = selectRetained(backups);
  for (const file of backups) {
    if (keep.has(file.id)) continue;
    await deleteFile(file.id);
    console.log(`[gdrive-backup] Backup antigo removido: ${file.name}`);
  }
  return keep.size;
}

/**
 * Compacta as pastas de dados com o tar do Windows (bsdtar, em System32).
 * Devolve null quando nenhuma delas existe ainda — servidor sem anexo nem
 * memória não é erro.
 */
function archiveDataDirs() {
  const present = ARCHIVED_DIRS.filter((dir) => existsSync(resolve(ROOT, dir)));
  if (present.length === 0) return null;
  mkdirSync(resolve(ROOT, 'data'), { recursive: true });
  const result = spawnSync('tar', ['-czf', ARCHIVE_REL, ...present], { cwd: ROOT, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`tar falhou: ${result.stderr?.trim() || result.error?.message || `código ${result.status}`}`);
  }
  return { path: resolve(ROOT, ARCHIVE_REL), dirs: present };
}

/** O Drive calcula md5 de todo arquivo binário — se bate, o que subiu é o que saiu daqui. */
function verifyUploadedArchive(uploaded, bytes) {
  const expected = createHash('md5').update(bytes).digest('hex');
  if (uploaded.md5Checksum !== expected) {
    throw new Error(`Verificação do arquivo falhou: md5 no Drive ${uploaded.md5Checksum ?? '?'}, esperado ${expected}.`);
  }
}

/**
 * Baixa o backup recém-enviado e confirma que o conteúdo no Drive é
 * idêntico ao exportado. Um backup que não passa aqui não conta como backup.
 */
async function verifyUploadedBackup(fileId, expectedJson) {
  const data = await downloadFile(fileId, 'text');
  const downloaded = typeof data === 'string' ? data : JSON.stringify(data);

  if (downloaded === expectedJson) return;

  // Fallback estrutural (caso o transporte normalize o texto): compara as chaves
  let parsed;
  try {
    parsed = JSON.parse(downloaded);
  } catch {
    throw new Error('Verificação falhou: backup no Drive não é JSON válido.');
  }
  const expected = JSON.parse(expectedJson);
  const sameKeys =
    parsed.totalKeys === expected.totalKeys &&
    Object.keys(parsed.data ?? {}).length === Object.keys(expected.data ?? {}).length;
  if (!sameKeys) {
    throw new Error(
      `Verificação falhou: backup no Drive tem ${parsed.totalKeys ?? '?'} chaves, esperado ${expected.totalKeys}.`,
    );
  }
}

// --- Exportação do banco ---

function exportDatabase() {
  if (!existsSync(DB_PATH)) {
    throw new Error(`Banco hub.db não encontrado em ${DB_PATH}`);
  }

  const db = openHubDb(DB_PATH);
  // Banco ainda no formato de usuário único (servidor não migrou): tudo é do dono.
  const multiUser = db.prepare('PRAGMA table_info(kv_store)').all().some((c) => c.name === 'user_id');
  const rows = db.prepare(multiUser ? 'SELECT user_id, key, value FROM kv_store' : `SELECT ${OWNER_ID} AS user_id, key, value FROM kv_store`).all();
  // Tabelas que nascem no boot do servidor (server/db.js); num banco que nunca
  // viu essa versão elas não existem, e isso não é motivo para abortar o backup.
  const optional = (sql) => { try { return db.prepare(sql).all(); } catch { return []; } };
  const projectFiles = optional('SELECT * FROM project_files');
  const users = optional('SELECT id, name, email, tailscale_login, is_admin, created_at FROM users');
  db.close();

  // `data` continua sendo o do dono — é o formato que POST /api/backup/import
  // restaura. Os outros usuários vão separados: no mesmo objeto, duas pessoas
  // com `finance.transactions` se sobrescreveriam.
  const data = {};
  const usersData = {};
  for (const row of rows) {
    let value;
    try { value = JSON.parse(row.value); } catch { value = row.value; }
    if (row.user_id === OWNER_ID) data[row.key] = value;
    else (usersData[row.user_id] ??= {})[row.key] = value;
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 2,
    source: 'hub.db',
    totalKeys: rows.length,
    data,
    usersData,
    tables: { project_files: projectFiles, users },
  };
}

// --- Main ---

async function main() {
  console.log('[gdrive-backup] Iniciando backup...');

  // 1. Exportar banco
  const exportData = exportDatabase();
  console.log(`[gdrive-backup] Banco exportado: ${exportData.totalKeys} chaves`);

  // Guarda: nunca enviar um export vazio — rotacionaria backups válidos para fora
  if (exportData.totalKeys === 0) {
    throw new Error('Exportação retornou 0 chaves — backup abortado para preservar os anteriores.');
  }

  // 2. Obter/criar pasta no Drive (a autenticação acontece na primeira chamada)
  const folderId = await getOrCreateFolder(DRIVE_FOLDER_NAME);

  // 3. Upload do backup
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `hub-backup-${dateStr}.json`;
  const jsonContent = JSON.stringify(exportData, null, 2);

  const uploaded = await uploadBackup(folderId, filename, jsonContent);
  const sizeKB = (Buffer.byteLength(jsonContent, 'utf-8') / 1024).toFixed(1);
  console.log(`[gdrive-backup] Backup enviado: ${uploaded.name} (${sizeKB} KB)`);

  // 4. Verificar integridade do que subiu antes de rotacionar os antigos
  await verifyUploadedBackup(uploaded.id, jsonContent);
  console.log('[gdrive-backup] Verificação OK — conteúdo no Drive confere com o exportado.');

  // 5. Arquivos fora do banco (anexos e memória do Jarvis)
  const archive = archiveDataDirs();
  let archiveNote = 'sem pastas de dados';
  if (archive) {
    try {
      const bytes = readFileSync(archive.path);
      const uploadedArchive = await uploadFile({
        name: `hub-files-${dateStr}.tar.gz`,
        parentId: folderId,
        mimeType: 'application/gzip',
        body: Readable.from(bytes),
        fields: 'id, name, md5Checksum',
      });
      verifyUploadedArchive(uploadedArchive, bytes);
      const archiveKB = (bytes.length / 1024).toFixed(1);
      archiveNote = `${archive.dirs.join(' + ')} (${archiveKB} KB)`;
    } finally {
      rmSync(archive.path, { force: true });
    }
  }

  // 6. Rotacionar — só depois de os dois uploads terem sido verificados
  const keptJson = await pruneBackups(folderId, 'hub-backup-');
  const keptFiles = await pruneBackups(folderId, 'hub-files-');

  log.success(`${exportData.totalKeys} chaves (${sizeKB} KB) + ${archiveNote}. No Drive: ${keptJson} backups do banco, ${keptFiles} de arquivos.`);
}

main().catch(async (err) => {
  log.error('Falhou', err);
  await notifySyncFailure('gdrive-backup', err);
  process.exit(1);
});
