/**
 * notify.js — push notification de falha para scripts agendados.
 * Envia via servidor do Hub (POST /api/push/send), que roda 24/7 no PM2.
 *
 * Nunca lança: se o servidor estiver offline, a falha original do script
 * já foi registrada no log local — este aviso é best-effort.
 *
 * Uso:
 *   import { notifySyncFailure } from '../lib/notify.js';
 *   main().catch(async (err) => {
 *     log.error('Erro fatal', err);
 *     await notifySyncFailure('meu-script', err);
 *     process.exit(1);
 *   });
 */

import { HUB_URL } from './hubApi.js';

/**
 * Push to the owner's devices (browser and APK) through the Hub server.
 * Never throws — see the header. `dedupeKey`: the server sends the same key at
 * most once a day (server/push.js) — a job failing every run must not push
 * every run.
 */
export async function notifyOwner({ title, body, url = '/', dedupeKey }) {
  try {
    await fetch(`${HUB_URL}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body: String(body ?? '').slice(0, 180), url, dedupeKey }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // servidor offline ou push não configurado — silencioso por design
  }
}

export async function notifySyncFailure(scriptName, err) {
  const detail = err instanceof Error ? err.message : String(err);
  await notifyOwner({ title: `⚠️ Sync falhou: ${scriptName}`, body: detail, url: '/automacoes', dedupeKey: `sync-failed:${scriptName}` });
}
