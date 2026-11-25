/**
 * push.js — notificações para o usuário atual, nos dois canais que existem:
 *
 * - **Web Push** (navegador/PWA): subscriptions VAPID em `push.subscriptions`.
 *   Setup: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_EMAIL no .env.
 * - **FCM** (APK Android): o WebView do Capacitor não tem Web Push, então o APK
 *   registra um token do Firebase Cloud Messaging em `push.devices`. Setup: a
 *   conta de serviço do projeto Firebase em scripts/config/ (ver getFcmAccess
 *   em server/google.js).
 *
 * Tudo aqui lê e grava as chaves do usuário atual (runAsUser): cada pessoa tem
 * os próprios aparelhos, e uma notificação nunca sai para o aparelho de outra.
 * Um canal sem configuração no servidor é pulado, não derruba o outro.
 */

import { kvStore } from './db.js';
import { getFcmAccess, hasFirebaseCredentials } from './google.js';

const SUBS_KEY = 'push.subscriptions';
const DEVICES_KEY = 'push.devices';
const FCM_API = (process.env.FCM_API_URL ?? 'https://fcm.googleapis.com').replace(/\/$/, '');
/** The Android channel the APK creates at startup (nativePush.ts). */
export const ANDROID_CHANNEL_ID = 'hub';

// ─── Web Push ────────────────────────────────────────────────────────────────

let webPush = null;
async function getWebPush() {
  if (webPush) return webPush;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY não configurados.');
  const rawEmail = process.env.VAPID_EMAIL ?? 'hub@local.dev';
  const email = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`;
  const wp = (await import('web-push')).default;
  wp.setVapidDetails(email, publicKey, privateKey);
  webPush = wp;
  return webPush;
}

function readList(key) {
  const raw = kvStore.get(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[push] ${key} corrompido, resetando:`, err.message);
    return [];
  }
}

function writeList(key, list) {
  kvStore.set(key, JSON.stringify(list));
}

async function deliverWeb(notifications) {
  const subs = readList(SUBS_KEY);
  if (!subs.length) return { sent: 0, removed: 0 };
  let wp;
  try {
    wp = await getWebPush();
  } catch {
    return { sent: 0, removed: 0, skipped: 'web-push não configurado' };
  }
  let sent = 0;
  const dead = new Set();
  for (const notification of notifications) {
    const payload = JSON.stringify(notification);
    for (const sub of subs) {
      try {
        await wp.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) dead.add(sub.endpoint);
      }
    }
  }
  if (dead.size) writeList(SUBS_KEY, subs.filter((s) => !dead.has(s.endpoint)));
  return { sent, removed: dead.size };
}

// ─── FCM (APK) ───────────────────────────────────────────────────────────────

/** FCM data payload values must be strings. */
function stringifyData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
}

function fcmMessage(token, { title, body, url = '/', ...extra }) {
  return {
    message: {
      token,
      notification: { title, body },
      data: stringifyData({ url, ...extra }),
      // ic_stat_hub: the orb silhouette (scripts/generate-icon.mjs); color = --hub-accent.
      android: { priority: 'high', notification: { channel_id: ANDROID_CHANNEL_ID, icon: 'ic_stat_hub', color: '#C1633D' } },
    },
  };
}

async function deliverFcm(notifications) {
  const devices = readList(DEVICES_KEY);
  if (!devices.length) return { sent: 0, removed: 0 };
  if (!hasFirebaseCredentials()) return { sent: 0, removed: 0, skipped: 'Firebase não configurado' };
  const { projectId, accessToken } = await getFcmAccess();
  let sent = 0;
  const dead = new Set();
  for (const notification of notifications) {
    for (const device of devices) {
      const res = await fetch(`${FCM_API}/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fcmMessage(device.token, notification)),
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      if (res?.ok) {
        sent++;
        continue;
      }
      // UNREGISTERED (404) / INVALID_ARGUMENT on the token (400): the app was
      // uninstalled or the token rotated — forget the device.
      if (res && (res.status === 404 || res.status === 400)) dead.add(device.token);
    }
  }
  if (dead.size) writeList(DEVICES_KEY, devices.filter((d) => !dead.has(d.token)));
  return { sent, removed: dead.size };
}

/**
 * Sends to every browser and APK of the current user. Never throws: callers
 * fire and forget (`void sendPushNotifications(...)` in the Jarvis), and an
 * unhandled rejection there would take the server down over a notification.
 */
export async function sendPushNotifications(notifications) {
  const safe = (deliver) => deliver(notifications).catch((err) => ({ sent: 0, removed: 0, error: err.message }));
  const [web, fcm] = await Promise.all([safe(deliverWeb), safe(deliverFcm)]);
  return { sent: web.sent + fcm.sent, removed: web.removed + fcm.removed, web, fcm };
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

export const pushRoutes = {
  /** Chave pública VAPID para o navegador assinar o Web Push. */
  getPublicKey(_req, res) {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'VAPID_PUBLIC_KEY não configurada.' });
    res.json({ publicKey: key });
  },

  subscribe(req, res) {
    const sub = req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'Subscription inválida.' });
    const subs = readList(SUBS_KEY);
    if (!subs.some((s) => s.endpoint === sub.endpoint)) {
      subs.push(sub);
      writeList(SUBS_KEY, subs);
    }
    res.json({ ok: true, total: subs.length });
  },

  unsubscribe(req, res) {
    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório.' });
    writeList(SUBS_KEY, readList(SUBS_KEY).filter((s) => s.endpoint !== endpoint));
    res.json({ ok: true });
  },

  /** O APK registra (ou renova) o token FCM deste aparelho. */
  registerDevice(req, res) {
    const token = String(req.body?.token ?? '').trim();
    if (token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'Token inválido.' });
    const device = String(req.body?.device ?? 'Android').slice(0, 80);
    const now = new Date().toISOString();
    const devices = readList(DEVICES_KEY).filter((d) => d.token !== token);
    devices.push({ token, device, platform: 'android', registeredAt: now });
    writeList(DEVICES_KEY, devices);
    res.json({ ok: true, total: devices.length, firebase: hasFirebaseCredentials() });
  },

  unregisterDevice(req, res) {
    const token = String(req.body?.token ?? '');
    writeList(DEVICES_KEY, readList(DEVICES_KEY).filter((d) => d.token !== token));
    res.json({ ok: true });
  },

  /**
   * Envia uma notificação a todos os aparelhos do usuário atual.
   *
   * `dedupeKey` (scripts' failure alerts): the same key is sent at most once
   * per DEDUPE_HOURS. The SIGAA sync runs every 2 h, and while its anti-bot
   * blocks it every run pushed the same "captcha" alert — up to eight a day
   * saying one thing. The health screen keeps the full picture.
   */
  async sendNotification(req, res) {
    const { title, body, url = '/', dedupeKey } = req.body ?? {};
    if (!title) return res.status(400).json({ error: 'title obrigatório.' });
    if (dedupeKey) {
      const sent = readDedupe();
      const last = sent[dedupeKey] ? new Date(sent[dedupeKey]).getTime() : 0;
      if (Date.now() - last < DEDUPE_HOURS * 3_600_000) return res.json({ ok: true, deduped: true });
      writeDedupe({ ...sent, [dedupeKey]: new Date().toISOString() });
    }
    res.json({ ok: true, ...(await sendPushNotifications([{ title, body, url }])) });
  },
};

const DEDUPE_KEY = 'push.dedupe';
export const DEDUPE_HOURS = 24;

function readDedupe() {
  try {
    return JSON.parse(kvStore.get(DEDUPE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

function writeDedupe(value) {
  kvStore.set(DEDUPE_KEY, JSON.stringify(value));
}
