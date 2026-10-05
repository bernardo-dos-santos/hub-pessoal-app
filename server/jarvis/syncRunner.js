/**
 * jarvis/syncRunner.js — dispara os scripts de sync a partir do servidor.
 *
 * O `run_sync` tinha ficado fora da Fase 5 (ver o cabeçalho antigo de
 * tools/actions.js): é Puppeteer de vários minutos, longe demais do timeout do
 * chat e arriscado demais para uma tool call disparar sozinha. O que mudou:
 * agora existe fila de aprovação (o Bernardo libera vendo o que vai rodar) e
 * tarefa em background, então o tempo deixou de ser problema.
 *
 * O processo é solto de propósito — quem pediu não espera o fim. O resultado
 * chega pela caixa de entrada e por push, como o de uma tarefa delegada.
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addInboxItem } from './inbox.js';
import { sendPushNotifications } from '../push.js';
import { logAudit } from './audit.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

/**
 * Teto de 20 min. SIGAA com muitos materiais passa fácil de 5; o que este
 * limite protege é o caso do Puppeteer travado num modal, que sem timeout
 * ficaria de pé até o servidor reiniciar.
 */
const TIMEOUT_MS = 20 * 60_000;

/** Só o que faz sentido rodar sob demanda — sync de saída (backup, calendar) fica no agendador. */
export const SYNCS = {
  sigaa: {
    label: 'SIGAA (faculdade)',
    script: 'scripts/sync/sigaa-sync.js',
    args: ['--headless'],
    hint: 'Abre o SIGAA num navegador headless e traz notas, tarefas e materiais. Leva alguns minutos.',
  },
  pluggy: {
    label: 'Pluggy (banco)',
    script: 'scripts/sync/pluggy-sync.js',
    args: [],
    hint: 'Puxa transações e investimentos via Open Finance para a fila de revisão.',
  },
};

/** Uma execução por sync de cada vez — dois Puppeteer no mesmo SIGAA se atrapalham. */
const running = new Map();

export function isSyncRunning(which) {
  return running.has(which);
}

/**
 * Dispara e devolve NA HORA. O `ok: true` aqui significa "começou", nunca
 * "terminou bem" — quem conta o fim é a inbox.
 */
export function startSync(which) {
  const sync = SYNCS[which];
  if (!sync) return { ok: false, error: `Sync desconhecido: "${which}". Disponíveis: ${Object.keys(SYNCS).join(', ')}.` };
  if (running.has(which)) return { ok: false, error: `O sync do ${sync.label} já está rodando.` };

  const startedAt = Date.now();
  // process.execPath = o mesmo node que roda o servidor; o filho herda o
  // process.env (que veio do --env-file no start), então PLUGGY_* e afins
  // chegam sem precisar repassar nada.
  const child = spawn(process.execPath, [sync.script, ...sync.args], {
    cwd: REPO_ROOT,
    windowsHide: true,
  });

  running.set(which, child);

  // Só a cauda da saída: o log inteiro do SIGAA tem centenas de linhas e o
  // destino aqui é um item de inbox, não um arquivo de log (esse o próprio
  // script já escreve).
  let tail = '';
  const capture = (chunk) => {
    tail = `${tail}${chunk}`.slice(-800);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);

  const timer = setTimeout(() => {
    child.kill();
    tail += `\n[interrompido: passou de ${TIMEOUT_MS / 60_000} minutos]`;
  }, TIMEOUT_MS);

  child.on('close', (code) => {
    clearTimeout(timer);
    running.delete(which);

    const minutos = Math.max(1, Math.round((Date.now() - startedAt) / 60_000));
    const ok = code === 0;
    logAudit('run_sync', { which }, { ok, exitCode: code });

    addInboxItem({
      kind: ok ? 'action_taken' : 'observation',
      title: ok ? `Sync do ${sync.label} concluído` : `Sync do ${sync.label} falhou (código ${code})`,
      body: `${minutos} min\n\n${tail.trim()}`.trim(),
    });

    void sendPushNotifications([{
      title: ok ? '✅ Sync concluído' : '⚠️ Sync falhou',
      body: `${sync.label} — ${ok ? `${minutos} min` : `código ${code}`}`,
      url: '/',
    }]).catch(() => null);
  });

  child.on('error', (err) => {
    clearTimeout(timer);
    running.delete(which);
    addInboxItem({
      kind: 'observation',
      title: `Sync do ${sync.label} não iniciou`,
      body: err.message,
    });
  });

  return {
    ok: true,
    started: true,
    which,
    message: `Sync do ${sync.label} iniciado. Aviso na caixa de entrada quando terminar.`,
  };
}
