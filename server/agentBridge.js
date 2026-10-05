/**
 * agentBridge.js — a ponte entre o Hub e o agente que roda na máquina do
 * Bernardo.
 *
 * A DIREÇÃO DA CONEXÃO É O PONTO. Antes o agente escutava numa porta e o
 * servidor discava até ele, o que só funciona quando os dois estão no mesmo
 * tailnet: uma máquina atrás do roteador de casa não tem endereço para ser
 * chamada. Agora o agente é quem abre a conexão (long-poll de saída) e fica
 * esperando trabalho — mesma forma que o `cloudflared` usa para expor o Hub
 * sem abrir porta no roteador.
 *
 * Consequências práticas:
 *   - funciona em qualquer rede, sem tailnet e sem porta aberta;
 *   - o notebook obedece fora de casa, coisa que não acontecia;
 *   - a autorização deixa de ser "de que IP veio" e passa a ser "que
 *     credencial apresentou", que é mais forte e não depende da topologia.
 *
 * Estado em memória de propósito: o hub-server roda em processo único (PM2 em
 * modo fork) e uma fila de despacho não deve sobreviver a restart — comando
 * que ficou pendurado numa reinicialização é comando fora de contexto. O que
 * PRECISA sobreviver (a fila de aprovação do Bernardo) mora no kv_store.
 */

import { randomUUID } from 'node:crypto';

/** Quanto o long-poll fica aberto antes de responder vazio e o agente repetir. */
const POLL_TIMEOUT_MS = 25_000;

/** Teto de espera por um resultado — acima disso o agente é dado como perdido. */
const RESULT_TIMEOUT_MS = 30_000;

/** Comandos aguardando o agente buscar. */
const queue = [];
/** commandId → { resolve, timer } de quem está esperando o resultado. */
const waiters = new Map();
/** Long-polls abertos, para acordar na hora que chega comando. */
let pollWaiters = [];
/** Último contato de cada dispositivo — alimenta o "online" no painel. */
const lastSeen = new Map();

function wakeOnePoller() {
  const next = pollWaiters.shift();
  if (next) next();
}

/**
 * Enfileira um comando e espera o resultado.
 * Rejeita se nenhum agente buscar (ou não responder) dentro do teto.
 */
export function dispatchToAgent(action, { timeoutMs = RESULT_TIMEOUT_MS } = {}) {
  const command = { id: randomUUID(), action, queuedAt: Date.now() };
  queue.push(command);
  wakeOnePoller();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(command.id);
      // Remove da fila se ainda nem foi buscado — senão o agente pegaria um
      // comando cujo pedido já desistiu.
      const idx = queue.findIndex((c) => c.id === command.id);
      if (idx !== -1) queue.splice(idx, 1);
      resolve({
        ok: false,
        error: 'O agente da máquina não respondeu. Ele está rodando e conectado ao Hub?',
      });
    }, timeoutMs);

    waiters.set(command.id, { resolve, timer });
  });
}

/**
 * Long-poll do agente. Resolve com um comando assim que houver um, ou com
 * `null` no timeout — devolver vazio de tempos em tempos é o que mantém a
 * conexão saudável e detecta queda de rede.
 */
export function waitForCommand(deviceId) {
  lastSeen.set(deviceId ?? 'default', Date.now());

  if (queue.length > 0) return Promise.resolve(queue.shift());

  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      pollWaiters = pollWaiters.filter((w) => w !== wake);
      resolve(value);
    };
    const wake = () => finish(queue.shift() ?? null);
    const timer = setTimeout(() => finish(null), POLL_TIMEOUT_MS);
    pollWaiters.push(wake);
  });
}

/** O agente devolveu o resultado de um comando. */
export function deliverResult(commandId, result) {
  const waiter = waiters.get(commandId);
  // Sem waiter significa que o pedido já desistiu por timeout — descartar é o
  // certo, mas vale o log: resultado órfão indica agente lento demais.
  if (!waiter) {
    console.warn(`[agent] resultado órfão do comando ${commandId} (o pedido já expirou).`);
    return false;
  }
  clearTimeout(waiter.timer);
  waiters.delete(commandId);
  waiter.resolve(result);
  return true;
}

/** Um agente deu sinal de vida nos últimos 90s? Alimenta o painel. */
export function agentStatus() {
  const now = Date.now();
  const devices = [...lastSeen.entries()].map(([id, at]) => ({
    id,
    lastSeenAt: new Date(at).toISOString(),
    online: now - at < 90_000,
  }));
  return { devices, anyOnline: devices.some((d) => d.online), queued: queue.length };
}

/**
 * Manda uma ação para a máquina do Bernardo.
 *
 * Mora aqui, e não em tools/index.js, para que os arquivos de domínio não
 * precisem importar de volta do index só por causa disto — esse ciclo
 * (index → machine → index) só se resolvia quando o index era a porta de
 * entrada, e estourava "Cannot access 'machineTools' before initialization"
 * por qualquer outro caminho.
 */
export async function callAgent(payload) {
  if (!process.env.AGENT_TOKEN) {
    return { ok: false, error: 'Agente não configurado (AGENT_TOKEN no .env do servidor e da máquina).' };
  }
  return await dispatchToAgent(payload);
}
