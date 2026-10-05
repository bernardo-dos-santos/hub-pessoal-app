/**
 * push.js — gerenciamento de Web Push subscriptions e envio de notificações.
 *
 * SETUP (uma vez):
 *   1. npm install (instala web-push)
 *   2. node -e "const wp = require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys()))"
 *   3. Salve as chaves geradas em .env (ou defina como variáveis de ambiente):
 *      VAPID_PUBLIC_KEY=<publicKey>
 *      VAPID_PRIVATE_KEY=<privateKey>
 *      VAPID_EMAIL=mailto:seu@email.com
 */

import { kvStore } from './db.js';

const SUBS_KEY = 'push.subscriptions';

// Carrega web-push de forma lazy (não instalado por padrão)
let webPush = null;
async function getWebPush() {
  if (webPush) return webPush;
  try {
    webPush = (await import('web-push')).default;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const rawEmail = process.env.VAPID_EMAIL ?? 'hub@local.dev';
    const email = rawEmail.startsWith('mailto:') ? rawEmail : `mailto:${rawEmail}`;
    if (!publicKey || !privateKey) throw new Error('VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY não configurados.');
    webPush.setVapidDetails(email, publicKey, privateKey);
    return webPush;
  } catch (err) {
    throw new Error(`web-push não disponível: ${err.message}. Execute npm install.`);
  }
}

function readSubscriptions() {
  const raw = kvStore.get(SUBS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (err) { console.warn('[push] subscriptions corrompidas, resetando:', err.message); return []; }
}

function writeSubscriptions(subs) {
  kvStore.set(SUBS_KEY, JSON.stringify(subs));
}

export const pushRoutes = {
  /** Retorna a chave pública VAPID para o frontend usar no subscribe. */
  getPublicKey(req, res) {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) return res.status(503).json({ error: 'VAPID_PUBLIC_KEY não configurada.' });
    res.json({ publicKey: key });
  },

  /** Salva uma subscription do browser. */
  subscribe(req, res) {
    const sub = req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'Subscription inválida.' });
    const subs = readSubscriptions();
    const exists = subs.some((s) => s.endpoint === sub.endpoint);
    if (!exists) {
      subs.push(sub);
      writeSubscriptions(subs);
    }
    res.json({ ok: true, total: subs.length });
  },

  /** Remove uma subscription (usuário desativou notificações). */
  unsubscribe(req, res) {
    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório.' });
    const subs = readSubscriptions().filter((s) => s.endpoint !== endpoint);
    writeSubscriptions(subs);
    res.json({ ok: true });
  },

  /** Envia uma notificação para todas as subscriptions salvas. */
  async sendNotification(req, res) {
    const { title, body, url = '/' } = req.body ?? {};
    if (!title) return res.status(400).json({ error: 'title obrigatório.' });
    const wp = await getWebPush();
    const subs = readSubscriptions();
    if (!subs.length) return res.json({ ok: true, sent: 0, message: 'Sem subscriptions.' });

    const payload = JSON.stringify({ title, body, url });
    let sent = 0;
    const failed = [];

    for (const sub of subs) {
      try {
        await wp.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expirada — remove
          failed.push(sub.endpoint);
        }
      }
    }

    if (failed.length > 0) {
      writeSubscriptions(subs.filter((s) => !failed.includes(s.endpoint)));
    }

    res.json({ ok: true, sent, removed: failed.length });
  },
};

/** Envia notificações em background (chamado pelo script de agendamento). */
export async function sendPushNotifications(notifications) {
  let wp;
  try { wp = await getWebPush(); } catch { return { error: 'web-push não disponível' }; }
  const subs = readSubscriptions();
  if (!subs.length) return { sent: 0 };

  let sent = 0;
  const failed = [];

  for (const notif of notifications) {
    const payload = JSON.stringify(notif);
    for (const sub of subs) {
      try {
        await wp.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) failed.push(sub.endpoint);
      }
    }
  }

  if (failed.length > 0) {
    writeSubscriptions(subs.filter((s) => !failed.includes(s.endpoint)));
  }

  return { sent, removed: failed.length };
}
