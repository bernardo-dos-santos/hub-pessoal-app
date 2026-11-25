/**
 * systemHealth.js — o que está quebrado ou parado, num lugar só.
 *
 * Existe por causa de um padrão que se repetiu: o dev gravando no banco de
 * produção, o agente local desconectado por 13 dias, o saldo do Gemini zerado
 * por semanas, o anti-bot do SIGAA aparecendo como senha errada. Nenhum desses
 * deu erro na tela — cada um falhava no próprio log, que ninguém abre.
 *
 * Por isso o silêncio também conta como falha: um job diário sem registro há
 * dois dias está tão quebrado quanto um que registrou erro, só que não avisa.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { agentStatus } from './agentBridge.js';
import { resolveSlot } from './ai/aiSettings.js';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_PATH = resolve(__dirname, '../logs/sync-log.json');

/**
 * Jobs que escrevem em logs/sync-log.json (via scripts/lib/logger.js).
 * `everyHours` é a cadência da tarefa HubPessoal-* registrada por
 * scripts/schedule/setup-all-tasks.ps1 (a fonte de verdade da agenda); null =
 * sem tarefa agendada, roda sob demanda (Jarvis, botão), então ficar quieto não
 * quer dizer nada. Mudou a agenda lá, muda aqui — senão a tela acusa "parado" o
 * que só mudou de ritmo.
 */
export const JOBS = [
  { script: 'sigaa-sync',                       label: 'SIGAA',                 everyHours: 24 },
  { script: 'gdrive-materials-sync',            label: 'Materiais do Drive',    everyHours: 24 },
  { script: 'generate-briefing',                label: 'Briefing',              everyHours: 24 },
  { script: 'send-daily-push',                  label: 'Push diário',           everyHours: 24 },
  { script: 'gdrive-backup',                    label: 'Backup no Drive',       everyHours: 24 },
  { script: 'calendar-sync',                    label: 'Agenda Google',         everyHours: 24 * 7 },
  { script: 'generate-weekly-plan',             label: 'Plano semanal',         everyHours: 24 * 7 },
  { script: 'college-calendar-sync',            label: 'Agenda da faculdade',   everyHours: 24 },
  { script: 'nubank-invoice-gmail-sync',        label: 'Fatura Nubank',         everyHours: 24 * 31 },
  { script: 'generate-monthly-finance-summary', label: 'Resumo financeiro',     everyHours: 24 * 31 },
];

/** Entradas do sync-log, mais nova primeiro (é a ordem em que o logger grava). */
export function readSyncLog() {
  try {
    const entries = existsSync(LOGS_PATH) ? JSON.parse(readFileSync(LOGS_PATH, 'utf-8')) : [];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/**
 * Estado de cada job:
 * - `error`: o último desfecho (success/error) registrado foi erro;
 * - `stale`: tem cadência e não registra nada há mais de 2× ela;
 * - `unknown`: nunca registrou nada — job novo no logger, ou nunca rodou;
 * - `ok`: o resto.
 */
export function jobsHealth(entries, now = Date.now()) {
  return JOBS.map((job) => {
    const own = entries.filter((e) => e.script === job.script);
    const last = own[0] ?? null;
    const outcome = own.find((e) => e.level === 'success' || e.level === 'error') ?? null;
    const lastSuccess = own.find((e) => e.level === 'success')?.timestamp ?? null;

    let status = 'ok';
    if (!last) status = 'unknown';
    else if (outcome?.level === 'error') status = 'error';
    else if (job.everyHours && now - new Date(last.timestamp).getTime() > 2 * job.everyHours * 3_600_000) status = 'stale';

    return {
      ...job,
      status,
      lastRun: last?.timestamp ?? null,
      lastMessage: (outcome ?? last)?.message ?? null,
      lastSuccess,
    };
  });
}

// ─── Public access (F4) ───────────────────────────────────────────────────────

/** How early a device certificate starts warning before it expires. */
export const CERT_WARN_DAYS = 30;

/**
 * Certificates that need attention: expired, or expiring within CERT_WARN_DAYS.
 * An expired one locks that person out without any error they could read —
 * Cloudflare blocks the phone before it reaches the Olimpo.
 */
export function certificatesHealth(certs, userName, now = Date.now()) {
  return certs
    .filter((cert) => !cert.revoked_at && cert.not_after)
    .map((cert) => {
      const daysLeft = Math.floor((new Date(cert.not_after).getTime() - now) / 86_400_000);
      return {
        label: cert.label,
        userName: userName(cert.user_id),
        notAfter: cert.not_after,
        daysLeft,
        status: daysLeft < 0 ? 'expired' : 'expiring',
      };
    })
    .filter((cert) => cert.daysLeft < CERT_WARN_DAYS);
}

/**
 * Is cloudflared connected to Cloudflare? It serves `/ready` on its metrics
 * port (127.0.0.1, 20241–20245, the first free one) — 200 with the number of
 * edge connections when the tunnel is up. If none answers, the Windows service
 * state is the next best sign. A tunnel down means everyone outside Tailscale
 * is locked out, which no other check here would notice.
 */
async function tunnelHealth() {
  for (let port = 20241; port <= 20245; port++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/ready`, { signal: AbortSignal.timeout(800) });
      const body = await res.json().catch(() => ({}));
      return { status: res.ok ? 'ok' : 'down', connections: body.readyConnections ?? null };
    } catch {
      // nothing on this port — try the next one
    }
  }
  if (process.platform !== 'win32') return { status: 'unknown', connections: null };
  try {
    const { stdout } = await execFileAsync('sc', ['query', 'cloudflared'], { timeout: 3000 });
    return { status: /RUNNING/.test(stdout) ? 'running' : 'down', connections: null };
  } catch {
    return { status: 'down', connections: null };
  }
}

/**
 * `certs` and `userName` come from the caller (server/index.js) so this file
 * stays free of db.js: scripts/core-check.js imports jobsHealth from here, and
 * importing the db would open a hub.db on whatever machine runs the tests.
 */
export async function systemHealth({ certs, userName }) {
  const agent = agentStatus();
  return {
    jobs: jobsHealth(readSyncLog()),
    agent: { anyOnline: agent.anyOnline, devices: agent.devices },
    // Sem Principal a cadeia recusa tudo (ver server/ai/chain.js) — é o único
    // estado de IA que dá para afirmar sem gastar uma chamada.
    ai: { principalConfigured: resolveSlot('principal') !== null },
    // null while the public port is off (no PUBLIC_PORT): nothing to watch.
    publicAccess: process.env.PUBLIC_PORT
      ? { tunnel: await tunnelHealth(), certificates: certificatesHealth(certs, userName) }
      : null,
  };
}
