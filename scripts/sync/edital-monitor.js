// Monitor de Edital — CBMSC e ABIN
// Roda via Task Scheduler uma vez por dia
// Requer Node 18+ (usa fetch nativo)
// Config: scripts/config/edital-config.json
// Output: public/edital-alerts.json (CBMSC) e public/abin-alerts.json (ABIN)

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { notifySyncFailure } from '../lib/notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONFIG_PATH = resolve(__dirname, '../config/edital-config.json');
const STATE_PATH = resolve(__dirname, '../config/edital-state.json');
const OUTPUT_CBMSC = resolve(ROOT, 'public/edital-alerts.json');
const OUTPUT_ABIN  = resolve(ROOT, 'public/abin-alerts.json');

function log(msg) {
  const ts = new Date().toLocaleString('pt-BR');
  console.log(`[${ts}] ${msg}`);
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    log('ERRO: edital-config.json não encontrado. Copie o .example.json e configure as URLs.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

function loadState() {
  if (!existsSync(STATE_PATH)) return {};
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function loadOutput(path) {
  if (!existsSync(path)) return { checkedAt: null, alerts: [] };
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return { checkedAt: null, alerts: [] }; }
}

function hash(text) {
  return createHash('md5').update(text).digest('hex');
}

function extractText(html) {
  // Remove scripts, styles e tags, normaliza espaços
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findKeywords(text, keywords) {
  return keywords.filter((kw) => text.includes(kw.toLowerCase()));
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  log('Iniciando monitor de edital CBMSC + ABIN...');

  const config = loadConfig();
  const state = loadState();

  // Carrega alertas existentes por grupo
  const outputCbmsc = loadOutput(OUTPUT_CBMSC);
  const outputAbin  = loadOutput(OUTPUT_ABIN);
  const alertsCbmsc = [...outputCbmsc.alerts];
  const alertsAbin  = [...outputAbin.alerts];
  let changedCbmsc = false;
  let changedAbin  = false;

  for (const target of config.targets) {
    const group = target.group ?? 'cbmsc'; // retrocompatibilidade com configs antigas
    log(`[${group.toUpperCase()}] Verificando: ${target.name} (${target.url})`);
    try {
      const html = await fetchPage(target.url);
      const text = extractText(html);
      const currentHash = hash(text);
      const previousHash = state[target.url]?.hash;

      state[target.url] = { hash: currentHash, lastChecked: new Date().toISOString() };

      if (previousHash && currentHash !== previousHash) {
        log(`  → Mudança detectada em: ${target.name}`);
        const found = findKeywords(text, target.keywords);

        if (found.length > 0) {
          log(`  → Palavras-chave encontradas: ${found.join(', ')}`);
          const targetAlerts = group === 'abin' ? alertsAbin : alertsCbmsc;
          const alreadyExists = targetAlerts.some(
            (a) => a.url === target.url && a.foundKeyword === found[0],
          );
          if (!alreadyExists) {
            targetAlerts.unshift({
              title: `Atualização detectada: ${target.name}`,
              url: target.url,
              foundKeyword: found[0],
              detectedAt: new Date().toISOString(),
            });
            if (group === 'abin') changedAbin = true;
            else changedCbmsc = true;
          }
        } else {
          log('  → Nenhuma palavra-chave relevante encontrada.');
        }
      } else if (!previousHash) {
        log('  → Primeiro check, estado salvo como referência.');
      } else {
        log('  → Sem mudanças.');
      }
    } catch (err) {
      log(`  → Erro ao acessar ${target.url}: ${err.message}`);
    }
  }

  const now = new Date().toISOString();

  // Grava alertas CBMSC
  writeFileSync(
    OUTPUT_CBMSC,
    JSON.stringify({ checkedAt: now, alerts: alertsCbmsc.slice(0, 20) }, null, 2),
  );

  // Grava alertas ABIN
  writeFileSync(
    OUTPUT_ABIN,
    JSON.stringify({ checkedAt: now, alerts: alertsAbin.slice(0, 20) }, null, 2),
  );

  saveState(state);

  const total = (changedCbmsc ? alertsCbmsc.length : 0) + (changedAbin ? alertsAbin.length : 0);
  log(total > 0 ? `Concluído — ${total} alerta(s) novos.` : 'Concluído — nenhuma novidade.');
}

main().catch(async (err) => {
  console.error('Erro fatal:', err);
  await notifySyncFailure('edital-monitor', err);
  process.exit(1);
});
