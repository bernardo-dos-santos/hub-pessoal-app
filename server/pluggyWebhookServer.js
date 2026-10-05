/**
 * pluggyWebhookServer.js — processo isolado, só recebe webhooks da Pluggy.
 *
 * DESATIVADO desde 2026-08-02: fora do `ecosystem.config.cjs` e com o Funnel
 * fechado. Recebia o aviso de transação nova mas só registrava no log — nada
 * no Hub reagia —, enquanto era a única porta aberta pra internet pública.
 * A coleta é feita por `scripts/sync/pluggy-sync.js`, que não depende disto.
 * O arquivo continua aqui como base pra alertas em tempo real; para religar,
 * ver as instruções no `ecosystem.config.cjs`.
 *
 * Roda separado do hub-server de propósito: é a única porta do PC dedicado
 * exposta pra internet pública (via Tailscale Funnel, porta 8443 inteira —
 * sem --set-path, porque o Funnel corta o prefixo do caminho ao repassar
 * por um mount de sub-path e isso já quebrou uma tentativa anterior). Por
 * ficar isolado num processo próprio, o que fica exposto não tem acesso ao
 * banco, ao storage nem a nenhuma outra rota do Hub — só sabe validar o
 * segredo e logar o evento.
 *
 * PM2: app "pluggy-webhook" no ecosystem.config.cjs.
 */
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createLogger } from '../scripts/lib/logger.js';

const log = createLogger('pluggy-webhook');
const PORT = process.env.PLUGGY_WEBHOOK_PORT ? Number(process.env.PLUGGY_WEBHOOK_PORT) : 3055;

function secretMatches(received) {
  const expected = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404).end();
    return;
  }

  const received = req.headers['x-pluggy-webhook-secret'];
  if (!secretMatches(received)) {
    log.warn(`Chamada rejeitada — segredo ausente ou inválido (ip=${req.socket.remoteAddress}).`);
    res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy();
  });
  req.on('end', () => {
    let event, itemId, eventId;
    try {
      ({ event, itemId, eventId } = JSON.parse(body || '{}'));
    } catch {
      // payload não-JSON — segue sem os campos, só loga o recebimento.
    }
    log.info(`${event ?? '?'} — item=${itemId ?? '?'} eventId=${eventId ?? '?'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
  });
}).listen(PORT, '127.0.0.1', () => {
  log.info(`Pluggy webhook server ouvindo em 127.0.0.1:${PORT}`);
});
