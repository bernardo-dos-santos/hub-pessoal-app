/**
 * gdrive-materials-sync.js
 * Sincroniza materiais da faculdade (PDFs baixados pelo SIGAA sync) para o Google Drive.
 * Faz upload incremental — apenas arquivos novos ou modificados (compara tamanho + nome).
 * Organiza em: Hub Materiais/<Disciplina>/
 *
 * Uso:
 *   node scripts/sync/gdrive-materials-sync.js
 *
 * Pré-requisito: token OAuth em scripts/config/token.json (via authorize-google.js)
 *
 * Task Scheduler: todos os dias às 19h30 (após o SIGAA sync das 19h)
 */

import { existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { createLogger } from '../lib/logger.js';
import { notifySyncFailure } from '../lib/notify.js';
import {
  hasGoogleAuth, getOrCreateFolder, listFolderFiles, uploadFile, deleteFile,
} from '../../server/google.js';

const log = createLogger('gdrive-materials-sync');
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Caminhos ---
// Onde o SIGAA sync salva os materiais baixados (configurável)
const MATERIALS_BASE = resolve(__dirname, '../../public/college-materials');

// --- Configurações ---
const DRIVE_ROOT_FOLDER = 'Hub Materiais';
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xlsx', '.xls', '.txt', '.zip']);

// --- Sincronização ---
async function syncDirectory(localDir, driveParentId, stats) {
  if (!existsSync(localDir)) return;

  const entries = readdirSync(localDir, { withFileTypes: true });
  const driveFiles = await listFolderFiles(driveParentId);
  const driveByName = new Map(driveFiles.map((f) => [f.name, f]));

  for (const entry of entries) {
    const localPath = resolve(localDir, entry.name);

    if (entry.isDirectory()) {
      // Sincronizar recursivamente subpastas (ex: por disciplina)
      const subFolderId = await getOrCreateFolder(entry.name, driveParentId);
      await syncDirectory(localPath, subFolderId, stats);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    const existing = driveByName.get(entry.name);
    const localSize = statSync(localPath).size;

    if (existing) {
      const driveSize = parseInt(existing.size ?? '0', 10);
      if (Math.abs(driveSize - localSize) < 100) {
        // Arquivo já existe com tamanho similar — pular
        stats.skipped++;
        continue;
      }
      // Tamanho diferente — deletar e re-upload
      await deleteFile(existing.id);
    }

    try {
      await uploadFile({ name: entry.name, parentId: driveParentId, body: createReadStream(localPath) });
      log.info(`Enviado: ${entry.name} (${(localSize / 1024).toFixed(0)} KB)`);
      stats.uploaded++;
    } catch (err) {
      log.error(`Falha ao enviar ${entry.name}`, err);
      stats.errors++;
    }
  }
}

// --- Main ---
async function main() {
  log.info('Iniciando sincronização de materiais para o Google Drive...');

  if (!existsSync(MATERIALS_BASE)) {
    log.warn(`Diretório de materiais não encontrado: ${MATERIALS_BASE}`);
    log.info('O SIGAA sync precisa ter sido executado ao menos uma vez com download de materiais.');
    process.exit(0);
  }

  if (!hasGoogleAuth()) {
    log.error('Token do Google ausente. Rode: node scripts/sync/authorize-google.js');
    process.exit(1);
  }

  const rootFolderId = await getOrCreateFolder(DRIVE_ROOT_FOLDER);

  const stats = { uploaded: 0, skipped: 0, errors: 0 };
  await syncDirectory(MATERIALS_BASE, rootFolderId, stats);

  log.success(
    `Sincronização concluída: ${stats.uploaded} enviado(s), ${stats.skipped} ignorado(s), ${stats.errors} erro(s).`,
  );
}

main().catch(async (err) => {
  log.error('Erro inesperado', err);
  await notifySyncFailure('gdrive-materials-sync', err);
  process.exit(1);
});
