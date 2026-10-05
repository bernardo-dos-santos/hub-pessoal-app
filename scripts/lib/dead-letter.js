/**
 * dead-letter.js — registro de emails que o parser não reconheceu.
 * Escreve em logs/unparsed-emails.json (últimos 100, dedup por emailId),
 * para que mudanças de formato nos emails do Nubank sejam diagnosticáveis
 * sem precisar refazer a busca no Gmail.
 *
 * Uso:
 *   import { recordUnparsedEmail } from '../lib/dead-letter.js';
 *   recordUnparsedEmail('nubank-sync', { emailId, subject, snippet });
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = resolve(__dirname, '../../logs');
const DEAD_LETTER_PATH = resolve(LOGS_DIR, 'unparsed-emails.json');
const MAX_ENTRIES = 100;

function readEntries() {
  try {
    return JSON.parse(readFileSync(DEAD_LETTER_PATH, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[dead-letter] arquivo corrompido, recriando:', err.message);
    return [];
  }
}

export function recordUnparsedEmail(script, { emailId, subject, snippet }) {
  const entries = readEntries();
  if (entries.some((e) => e.emailId === emailId)) return false;

  entries.unshift({
    timestamp: new Date().toISOString(),
    script,
    emailId,
    subject,
    snippet: (snippet ?? '').slice(0, 300),
  });

  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  writeFileSync(DEAD_LETTER_PATH, JSON.stringify(entries.slice(0, MAX_ENTRIES), null, 2), 'utf-8');
  return true;
}
