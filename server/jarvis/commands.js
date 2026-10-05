/**
 * jarvis/commands.js — a fila de aprovação.
 *
 * O ponto central: A APROVAÇÃO NUNCA VEM DO MODELO. O Jarvis pede; quem
 * libera é o Bernardo, vendo o texto literal do que vai acontecer. Entre o
 * pedido e a execução existe um passo humano que nenhum prompt consegue pular.
 *
 * A fila mora no kv_store (e não em memória, como a fila de despacho do
 * agentBridge) porque ela precisa sobreviver a um restart: um pedido esperando
 * aprovação é justamente o que não pode sumir quando o servidor reinicia.
 *
 * Nasceu só para shell (Fase 8) e ganhou mais tipos na Fase 11 — escrita no
 * Google e disparo de sync. Cada item carrega `kind` e é executado pelo
 * despachante correspondente em `approveCommand`. O campo `command` continua
 * sendo o TEXTO VERBATIM mostrado no painel, seja ele um comando de terminal
 * ou o e-mail inteiro que está prestes a sair — é o que o Bernardo lê antes de
 * decidir, então nunca pode ser um resumo produzido pelo modelo.
 */

import { kvStore } from '../db.js';
import { kv } from './context.js';
import { dispatchToAgent } from '../agentBridge.js';
import { sendPushNotifications } from '../push.js';
import { logAudit } from './audit.js';
import { addInboxItem } from './inbox.js';
import { startSync } from './syncRunner.js';

const KEY = 'jarvis.pendingCommands';
const MAX_KEPT = 50;

/**
 * Pendência expira em 10 minutos. Não é detalhe: comando aprovado uma hora
 * depois é comando aprovado fora de contexto — você não lembra mais por que
 * ele pediu, e o estado da máquina mudou.
 */
const EXPIRY_MS = 10 * 60_000;

/**
 * Comandos de leitura que rodam direto a partir do nível 3. Prefixo, não
 * comando inteiro, para caber `git status --short`. Deliberadamente curta e
 * só com coisas que não escrevem nada.
 */
const AUTO_APPROVED_PREFIXES = [
  'git status', 'git log', 'git diff', 'git branch',
  'ls', 'dir', 'pwd', 'cd', 'whoami', 'hostname',
  'type ', 'cat ', 'echo ',
  'npm test', 'npm run check', 'npm run build',
];

function genId() {
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function load() {
  return kv(KEY) ?? [];
}

function save(list) {
  kvStore.set(KEY, JSON.stringify(list.slice(0, MAX_KEPT)));
}

/** Marca como expirada toda pendência que passou do prazo. */
function expireStale(list) {
  const now = Date.now();
  let changed = false;
  for (const c of list) {
    if (c.status === 'pending' && new Date(c.expiresAt).getTime() < now) {
      c.status = 'expired';
      changed = true;
    }
  }
  return changed;
}

export function listCommands() {
  const list = load();
  if (expireStale(list)) save(list);
  return list;
}

export function pendingCount() {
  return listCommands().filter((c) => c.status === 'pending').length;
}

function isAutoApproved(command, level) {
  if (level >= 4) return true;
  if (level < 3) return false;
  const normalized = command.trim().toLowerCase();
  return AUTO_APPROVED_PREFIXES.some((p) => normalized.startsWith(p));
}

/** Executa de fato e devolve o resultado do agente. */
async function runNow(command) {
  const result = await dispatchToAgent({ action: 'exec', command }, { timeoutMs: 60_000 });
  logAudit('run_on_machine', { command }, result);
  return result;
}

/**
 * Enfileira um pedido genérico — Google e sync entram por aqui.
 *
 * Diferente do shell, NADA disto é auto-aprovável: não existe nível de acesso
 * que libere mandar e-mail sozinho. O nível de acesso à máquina governa a
 * máquina; mandar coisa para fora em nome do Bernardo é outro eixo, e o único
 * valor sensato nele é "sempre pergunta".
 */
export function requestApproval({ kind, display, why, payload }) {
  const text = String(display ?? '').trim();
  if (!text) return { ok: false, error: 'Pedido sem descrição do que seria feito.' };

  const now = Date.now();
  const entry = {
    id: genId(),
    kind,
    command: text,
    why: why ?? null,
    payload: payload ?? null,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + EXPIRY_MS).toISOString(),
    result: null,
  };

  const list = load();
  expireStale(list);
  save([entry, ...list]);

  void sendPushNotifications([{
    title: PUSH_TITLE[kind] ?? '🔐 JARVIS pede aprovação',
    body: text.length > 120 ? `${text.slice(0, 120)}…` : text,
    url: '/',
  }]).catch(() => null);

  return {
    ok: true,
    pending: true,
    commandId: entry.id,
    message: 'Pedido registrado. Aguardando a aprovação do Senhor no painel — expira em 10 minutos.',
  };
}

const PUSH_TITLE = {
  shell: '🔐 JARVIS quer rodar um comando',
  google: '🔐 JARVIS quer escrever numa conta sua',
  sync: '🔐 JARVIS quer disparar um sync',
};

/**
 * Executa a pendência aprovada, conforme o tipo.
 *
 * O import do Google é dinâmico para quebrar o ciclo: tools/google.js importa
 * daqui (para enfileirar) e precisaria ser importado aqui (para executar).
 * Mesmo padrão do delegate_task em tools/index.js — só carrega de fato na hora
 * em que alguém aprova.
 */
async function runApproved(entry) {
  switch (entry.kind ?? 'shell') {
    case 'shell':
      return await runNow(entry.command);

    case 'google': {
      const { executeGoogleWrite } = await import('./tools/google.js');
      return await executeGoogleWrite(entry.payload.tool, entry.payload.args);
    }

    case 'sync':
      return startSync(entry.payload.which);

    default:
      return { ok: false, error: `Tipo de pendência desconhecido: "${entry.kind}".` };
  }
}

const DONE_TITLE = {
  shell: ['Comando executado no notebook', 'Comando falhou no notebook'],
  google: ['Ação executada na sua conta Google', 'Ação no Google falhou'],
  sync: ['Sync disparado', 'Sync não iniciou'],
};

/**
 * Pedido de execução na máquina.
 *
 * Devolve na hora nos dois caminhos — nem o auto-aprovado (que espera o
 * agente) nem o pendente (que espera VOCÊ) podem prender o turno do chat.
 */
export async function requestCommand({ command, why, level, tainted }) {
  const cmd = String(command ?? '').trim();
  if (!cmd) return { ok: false, error: 'Comando vazio.' };

  // O modo cauteloso já barra antes de chegar aqui (executeToolAudited), mas a
  // checagem é repetida de propósito: esta função também é alcançável por
  // outros caminhos, e uma trava de segurança que existe num lugar só é uma
  // trava que alguém vai contornar sem querer.
  if (tainted) {
    return {
      ok: false,
      error: 'Este turno já leu conteúdo externo — execução na máquina não é liberada automaticamente depois disso.',
    };
  }

  if (isAutoApproved(cmd, level)) {
    const result = await runNow(cmd);
    return { ...result, autoApproved: true };
  }

  return requestApproval({ kind: 'shell', display: cmd, why });
}

/** Bernardo aprovou: despacha, guarda o resultado e avisa pela caixa de entrada. */
export async function approveCommand(id) {
  const list = listCommands();
  const entry = list.find((c) => c.id === id);
  if (!entry) return { ok: false, error: 'Pedido não encontrado.' };
  if (entry.status !== 'pending') return { ok: false, error: `Pedido já está "${entry.status}".` };

  entry.status = 'running';
  save(list);

  const result = await runApproved(entry);

  const after = listCommands();
  const target = after.find((c) => c.id === id);
  if (target) {
    target.status = result.ok ? 'done' : 'error';
    target.result = result.message ?? result.error ?? null;
    target.finishedAt = new Date().toISOString();
    save(after);
  }

  const [tituloOk, tituloErro] = DONE_TITLE[entry.kind ?? 'shell'] ?? DONE_TITLE.shell;
  addInboxItem({
    kind: result.ok ? 'action_taken' : 'observation',
    title: result.ok ? tituloOk : tituloErro,
    body: `${entry.command}\n\n${result.message ?? result.error ?? ''}`.trim(),
  });

  return result;
}

export function rejectCommand(id) {
  const list = listCommands();
  const entry = list.find((c) => c.id === id);
  if (!entry) return { ok: false, error: 'Pedido não encontrado.' };
  if (entry.status !== 'pending') return { ok: false, error: `Pedido já está "${entry.status}".` };
  entry.status = 'rejected';
  entry.finishedAt = new Date().toISOString();
  save(list);
  return { ok: true };
}
