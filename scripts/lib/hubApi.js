/**
 * hubApi.js — where scheduled scripts reach the Olimpo's API, and waiting for it.
 *
 * 127.0.0.1, not "localhost": the server listens on 0.0.0.0 (IPv4) only, and
 * when Node's fetch resolves "localhost" to ::1 first the connection fails with
 * no IPv4 fallback — that kept the briefing from running from 24/06.
 */

export const HUB_URL = process.env.HUB_BACKEND ?? 'http://127.0.0.1:3001';

/**
 * Resolves once /api/health answers, polling every 15 s up to `maxMinutes`.
 * After a power cut every overdue job starts at boot, minutes before the
 * server opens its port (2026-11-16: 8 minutes on the server's hard disk), and
 * each one used to fail with "fetch failed". Throws if it never comes up.
 */
export async function waitForHub({ maxMinutes = 15, log } = {}) {
  const deadline = Date.now() + maxMinutes * 60_000;
  let warned = false;
  for (;;) {
    try {
      const res = await fetch(`${HUB_URL}/api/health`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`servidor do Olimpo não respondeu em ${maxMinutes} min`);
    if (!warned) {
      log?.info('Servidor ainda não respondeu — aguardando ele subir...');
      warned = true;
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
}
