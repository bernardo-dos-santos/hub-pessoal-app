/**
 * pendingFiles.js — onde os syncs deixam o que o app importa depois.
 *
 * Esses arquivos moravam em `public/`, e isso tinha dois efeitos que ninguém
 * escolheu: o Vite copiava o extrato bancário para `dist/` e dali para dentro
 * do APK, e o `express.static` servia tudo fora da auth de `/api` — qualquer
 * aparelho no Wi-Fi de casa lia o extrato pendente. Em `data/` eles só
 * saem por `GET /api/pending/:name`, que herda a auth e o NetworkOnly do
 * service worker.
 */

import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OWNER_ID } from './userContext.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.HUB_DATA_DIR ?? resolve(__dirname, '../data');
const PENDING_DIR = resolve(DATA_DIR, 'pending');

/** Allowlist: o nome vira caminho de arquivo, então só valores conhecidos. */
export const PENDING_NAMES = ['sigaa', 'nubank-invoice'];

/**
 * Cada usuário tem a própria pasta (`data/pending/<id>/`): a fila de um
 * amigo não pode cair na fila de importação de outro.
 */
export function pendingPath(name, userId) {
  if (!PENDING_NAMES.includes(name)) throw new Error(`Pending desconhecido: ${name}`);
  if (!Number.isInteger(userId) || userId < 1) throw new Error(`pendingPath: userId inválido (${userId})`);
  return resolve(PENDING_DIR, String(userId), `${name}-pending.json`);
}

export function writePending(name, json, userId) {
  const path = pendingPath(name, userId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, json, 'utf-8');
  return path;
}

/** Arquivos de antes do multiusuário (direto em data/pending/) são do dono. Idempotente. */
export function migrateLegacyPending() {
  if (!existsSync(PENDING_DIR)) return;
  for (const file of readdirSync(PENDING_DIR)) {
    if (!file.endsWith('-pending.json')) continue;
    const target = resolve(PENDING_DIR, String(OWNER_ID), file);
    mkdirSync(dirname(target), { recursive: true });
    if (!existsSync(target)) renameSync(resolve(PENDING_DIR, file), target);
  }
}
