/**
 * logger.js — logger centralizado para scripts de sincronização do Hub Pessoal.
 * Escreve em logs/sync-log.json mantendo os últimos 500 registros.
 *
 * Uso:
 *   import { createLogger } from '../lib/logger.js';
 *   const log = createLogger('meu-script');
 *   log.info('Sincronização iniciada');
 *   log.error('Erro ao buscar dados', err);
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, '../../logs');
const LOGS_PATH = resolve(LOGS_DIR, 'sync-log.json');
const MAX_ENTRIES = 500;

function ensureLogsDir() {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
}

function readLog() {
  try {
    return JSON.parse(readFileSync(LOGS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function writeLog(entries) {
  ensureLogsDir();
  writeFileSync(LOGS_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

function appendEntry(script, level, message) {
  const entries = readLog();
  entries.unshift({
    timestamp: new Date().toISOString(),
    script,
    level,
    message: typeof message === 'string' ? message : String(message),
  });
  writeLog(entries.slice(0, MAX_ENTRIES));
}

export function createLogger(scriptName) {
  const log = {
    info(message)  { console.log(`[${scriptName}] ${message}`);  appendEntry(scriptName, 'info',  message); },
    warn(message)  { console.warn(`[${scriptName}] WARN: ${message}`);  appendEntry(scriptName, 'warn',  message); },
    error(message, err) {
      const detail = err instanceof Error ? ` — ${err.message}` : '';
      const full = `${message}${detail}`;
      console.error(`[${scriptName}] ERROR: ${full}`);
      appendEntry(scriptName, 'error', full);
    },
    success(message) { console.log(`[${scriptName}] ✓ ${message}`); appendEntry(scriptName, 'success', message); },
  };
  return log;
}
