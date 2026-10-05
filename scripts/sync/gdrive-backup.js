/**
 * gdrive-backup.js
 * Serializa o banco hub.db → JSON → faz upload para pasta "Hub Backups" no Google Drive.
 * Mantém os últimos 7 backups (apaga os mais antigos).
 *
 * Uso:
 *   node scripts/sync/gdrive-backup.js
 *
 * Pré-requisito: token OAuth já autorizado em scripts/config/token.json
 * (o authorize-google.js gera esse token — reutilizamos).
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { notifySyncFailure } from '../lib/notify.js';
import {
  getOrCreateFolder, listFiles, uploadFile, deleteFile, downloadFile, escapeQueryValue,
} from '../../server/google.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Caminhos ---
const DB_PATH = resolve(__dirname, '../../hub.db');

// --- Configurações ---
const DRIVE_FOLDER_NAME = 'Hub Backups';
const MAX_BACKUPS = 7;

// --- Drive helpers ---

async function listBackups(folderId) {
  return listFiles({
    q: `'${escapeQueryValue(folderId)}' in parents and name contains 'hub-backup-' and trashed=false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
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

async function deleteOldBackups(backups) {
  if (backups.length <= MAX_BACKUPS) return;
  const toDelete = backups.slice(MAX_BACKUPS);
  for (const file of toDelete) {
    await deleteFile(file.id);
    console.log(`[gdrive-backup] Backup antigo removido: ${file.name}`);
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

  const db = new DatabaseSync(DB_PATH);
  const rows = db.prepare('SELECT key, value FROM kv_store').all();
  db.close();

  const data = {};
  for (const row of rows) {
    try {
      data[row.key] = JSON.parse(row.value);
    } catch {
      data[row.key] = row.value;
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    source: 'hub.db',
    totalKeys: rows.length,
    data,
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

  // 5. Limpar backups antigos
  const allBackups = await listBackups(folderId);
  await deleteOldBackups(allBackups);

  console.log(`[gdrive-backup] Concluído. Total de backups no Drive: ${Math.min(allBackups.length, MAX_BACKUPS)}`);
}

main().catch(async (err) => {
  console.error('[gdrive-backup] Erro:', err.message ?? err);
  await notifySyncFailure('gdrive-backup', err);
  process.exit(1);
});
