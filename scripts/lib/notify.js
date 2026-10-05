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

const HUB_URL = process.env.HUB_BACKEND ?? 'http://localhost:3001';

export async function notifySyncFailure(scriptName, err) {
  const detail = err instanceof Error ? err.message : String(err);
  try {
    await fetch(`${HUB_URL}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `⚠️ Sync falhou: ${scriptName}`,
        body: detail.slice(0, 180),
        url: '/',
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // servidor offline ou push não configurado — silencioso por design
  }
}
