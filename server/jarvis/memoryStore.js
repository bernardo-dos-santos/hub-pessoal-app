/**
 * jarvis/memoryStore.js — o backend em disco da memory tool (memory_20250818).
 *
 * A memory tool é uma tool "client-side" da Anthropic: o modelo PEDE operações
 * de arquivo (view/create/str_replace/insert/delete/rename) num diretório
 * virtual `/memories`, e quem executa é este arquivo. Não existe schema para
 * declarar — a API já conhece os comandos e injeta sozinha o protocolo de
 * memória no system prompt.
 *
 * POR QUE ISTO SUBSTITUIU `jarvis.memories`:
 * a memória antiga era uma lista de fatos no kv_store que entrava INTEIRA no
 * system prompt de toda chamada — chat, tick e tarefa. Por isso existia um teto
 * de 60 fatos: não era limite de memória, era limite de custo. Com arquivos, o
 * que o modelo sabe deixa de caber no prompt e passa a ser lido sob demanda;
 * o teto some porque o disco não é o prompt.
 *
 * O QUE AINDA VIAJA NO PROMPT: só `perfil.md` (ver `readProfile`), com corte
 * duro de tamanho. É o resumo "sempre carregado" — sem ele, toda conversa
 * começaria com uma ida e volta extra só para o modelo descobrir quem é o
 * Bernardo. O resto de `/memories` ele abre quando precisa.
 *
 * Formato de resposta: strings, não JSON. Os textos de retorno e de erro
 * seguem literalmente os da documentação da tool — o modelo foi treinado
 * neles, e inventar texto próprio é a diferença entre ele entender "arquivo
 * não existe, crio agora" e ficar tentando de novo.
 */

import {
  existsSync, mkdirSync, readFileSync, readdirSync, realpathSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kvStore } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Raiz em disco, fora do hub.db. Arquivo de memória cresce sem teto e é texto
 * que o Bernardo pode querer abrir e editar no bloco de notas — as duas coisas
 * são péssimas para uma linha de kv_store, que é lida e reescrita inteira e
 * viaja nos snapshots de `/api/store`.
 *
 * Um nível por usuário desde já: o Hub vai ser multiusuário e memória é o dado
 * mais pessoal que existe aqui. Vazar a memória de um usuário para outro por
 * falta de uma pasta é o tipo de erro que não dá para consertar depois.
 */
const STORE_ROOT = resolve(__dirname, '../../jarvis-memory');
const DEFAULT_USER = 'default';

/** Caminho virtual que o modelo enxerga. Nada fora daqui é acessível. */
const VIRTUAL_ROOT = '/memories';

/** Arquivo sempre carregado no contexto (ver o cabeçalho). */
export const PROFILE_PATH = `${VIRTUAL_ROOT}/perfil.md`;

/** Teto por arquivo — evita que uma escrita descontrolada encha o disco. */
const MAX_FILE_BYTES = 256 * 1024;

/** Corte da leitura: a própria tool avisa ao modelo que trunca em 16k chars. */
const MAX_VIEW_CHARS = 16_000;

/**
 * Corte do perfil no prompt. Este número É o antigo teto de 60 fatos, só que
 * medido onde ele importa: ~2.000 caracteres ≈ 500 tokens em toda chamada.
 * O resto da memória não paga esse pedágio.
 */
const MAX_PROFILE_CHARS = 2_000;

const MAX_LINES = 999_999;

function userRoot(userId = DEFAULT_USER) {
  return resolve(STORE_ROOT, userId);
}

function ensureRoot(userId) {
  const root = userRoot(userId);
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  return root;
}

/**
 * Traduz o caminho virtual em caminho real, ou devolve null se ele escapar.
 *
 * Três defesas, porque uma só não basta: (1) exige o prefixo `/memories`;
 * (2) `resolve` normaliza `..` e o resultado tem que continuar dentro da raiz —
 * é isto que barra `/memories/../../.env`; (3) quando o alvo já existe,
 * `realpathSync` desfaz symlink e a checagem é refeita — sem isso um link
 * plantado dentro da pasta apontaria para fora dela.
 *
 * O decode de %2e%2e%2f vem antes de tudo: sem ele a checagem (2) receberia o
 * caminho ainda codificado, acharia que não tem `..` nenhum, e o sistema de
 * arquivos decodificaria depois.
 */
function realPath(virtualPath, userId) {
  const raw = String(virtualPath ?? '');
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { decoded = raw; }
  decoded = decoded.replace(/\\/g, '/');

  if (decoded !== VIRTUAL_ROOT && !decoded.startsWith(`${VIRTUAL_ROOT}/`)) return null;

  const relative = decoded.slice(VIRTUAL_ROOT.length).replace(/^\/+/, '');
  const root = ensureRoot(userId);
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) return null;

  if (existsSync(target)) {
    const real = realpathSync(target);
    const realRoot = realpathSync(root);
    if (real !== realRoot && !real.startsWith(realRoot + sep)) return null;
  }
  return target;
}

function isRoot(virtualPath) {
  return String(virtualPath ?? '').replace(/\/+$/, '') === VIRTUAL_ROOT;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

function fail(text) {
  return { ok: false, text };
}

function done(text) {
  return { ok: true, text };
}

/** Numeração de linha da tool: 6 colunas, alinhada à direita, tab de separador. */
function numbered(content) {
  return content.split('\n').map((line, i) => `${String(i + 1).padStart(6, ' ')}\t${line}`).join('\n');
}

/** Listagem de até 2 níveis, sem ocultos e sem node_modules (contrato da tool). */
function listDir(realDir, virtualDir, depth = 2) {
  const out = [];
  for (const entry of readdirSync(realDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const realChild = join(realDir, entry.name);
    const virtualChild = `${virtualDir}/${entry.name}`;
    const stats = statSync(realChild);
    out.push(`${humanSize(stats.size)}\t${virtualChild}`);
    if (entry.isDirectory() && depth > 1) out.push(...listDir(realChild, virtualChild, depth - 1));
  }
  return out;
}

// ── Comandos ─────────────────────────────────────────────────────────────────

function cmdView(args, userId) {
  const target = realPath(args.path, userId);
  if (!target) return fail(`The path ${args.path} does not exist. Please provide a valid path.`);
  if (!existsSync(target)) return fail(`The path ${args.path} does not exist. Please provide a valid path.`);

  if (statSync(target).isDirectory()) {
    const header = `Here're the files and directories up to 2 levels deep in ${args.path}, `
      + 'excluding hidden items and node_modules:';
    const self = `${humanSize(statSync(target).size)}\t${String(args.path).replace(/\/+$/, '')}`;
    return done([header, self, ...listDir(target, String(args.path).replace(/\/+$/, ''))].join('\n'));
  }

  let content = readFileSync(target, 'utf8');
  const lines = content.split('\n');
  if (lines.length > MAX_LINES) return fail(`File ${args.path} exceeds maximum line limit of ${MAX_LINES} lines.`);

  const range = args.view_range;
  if (Array.isArray(range) && range.length === 2) {
    const start = Math.max(1, Number(range[0]) || 1);
    const end = Number(range[1]) === -1 ? lines.length : Math.min(lines.length, Number(range[1]));
    const slice = lines.slice(start - 1, end)
      .map((line, i) => `${String(start + i).padStart(6, ' ')}\t${line}`)
      .join('\n');
    return done(`Here's the content of ${args.path} with line numbers:\n${slice}`);
  }

  let body = numbered(content);
  if (body.length > MAX_VIEW_CHARS) {
    body = `${body.slice(0, MAX_VIEW_CHARS)}\n… (corte em ${MAX_VIEW_CHARS} caracteres — use view_range para ler o resto)`;
  }
  return done(`Here's the content of ${args.path} with line numbers:\n${body}`);
}

/**
 * `create` sobrescreve em vez de recusar quando o arquivo existe.
 *
 * A documentação oferece as duas condutas e sugere o erro como referência, mas
 * a descrição que o modelo recebe diz "creates or overwrites" — ou seja, ele
 * chama `create` em caminho existente de propósito, achando que está
 * reescrevendo. Devolver erro aí transformaria uma reescrita legítima do perfil
 * numa ida e volta extra (delete, depois create) a cada atualização.
 */
function cmdCreate(args, userId) {
  const target = realPath(args.path, userId);
  if (!target || isRoot(args.path)) return fail(`Error: The path ${args.path} does not exist`);
  const text = String(args.file_text ?? '');
  if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
    return fail(`Error: ${args.path} exceeds the maximum file size of ${humanSize(MAX_FILE_BYTES)}. Split the content into smaller files.`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text, 'utf8');
  return done(`File created successfully at: ${args.path}`);
}

function cmdStrReplace(args, userId) {
  const target = realPath(args.path, userId);
  if (!target || !existsSync(target) || statSync(target).isDirectory()) {
    return fail(`Error: The path ${args.path} does not exist. Please provide a valid path.`);
  }
  const content = readFileSync(target, 'utf8');
  const oldStr = String(args.old_str ?? '');
  const parts = content.split(oldStr);
  if (oldStr === '' || parts.length === 1) {
    return fail(`No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${args.path}.`);
  }
  if (parts.length > 2) {
    const linhas = content.split('\n')
      .map((line, i) => (line.includes(oldStr) ? i + 1 : null))
      .filter(Boolean)
      .join(', ');
    return fail(`No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${linhas}. Please ensure it is unique`);
  }
  const next = parts.join(String(args.new_str ?? ''));
  if (Buffer.byteLength(next, 'utf8') > MAX_FILE_BYTES) {
    return fail(`Error: ${args.path} exceeds the maximum file size of ${humanSize(MAX_FILE_BYTES)}.`);
  }
  writeFileSync(target, next, 'utf8');
  return done(`The memory file has been edited.\n${numbered(next).slice(0, 2000)}`);
}

function cmdInsert(args, userId) {
  const target = realPath(args.path, userId);
  if (!target || !existsSync(target) || statSync(target).isDirectory()) {
    return fail(`Error: The path ${args.path} does not exist`);
  }
  const lines = readFileSync(target, 'utf8').split('\n');
  const at = Number(args.insert_line);
  if (!Number.isInteger(at) || at < 0 || at > lines.length) {
    return fail(`Error: Invalid \`insert_line\` parameter: ${args.insert_line}. It should be within the range of lines of the file: [0, ${lines.length}]`);
  }
  lines.splice(at, 0, String(args.insert_text ?? '').replace(/\n$/, ''));
  const next = lines.join('\n');
  if (Buffer.byteLength(next, 'utf8') > MAX_FILE_BYTES) {
    return fail(`Error: ${args.path} exceeds the maximum file size of ${humanSize(MAX_FILE_BYTES)}.`);
  }
  writeFileSync(target, next, 'utf8');
  return done(`The file ${args.path} has been edited.`);
}

function cmdDelete(args, userId) {
  // A própria descrição da tool diz ao modelo que ele não pode apagar a raiz —
  // recusar aqui é o que faz a regra valer mesmo se ele tentar.
  if (isRoot(args.path)) return fail('Error: The /memories directory cannot be deleted');
  const target = realPath(args.path, userId);
  if (!target || !existsSync(target)) return fail(`Error: The path ${args.path} does not exist`);
  rmSync(target, { recursive: true, force: true });
  return done(`Successfully deleted ${args.path}`);
}

function cmdRename(args, userId) {
  if (isRoot(args.old_path)) return fail('Error: The /memories directory cannot be renamed');
  const from = realPath(args.old_path, userId);
  const to = realPath(args.new_path, userId);
  if (!from || !existsSync(from)) return fail(`Error: The path ${args.old_path} does not exist`);
  if (!to) return fail(`Error: The path ${args.new_path} does not exist`);
  if (existsSync(to)) return fail(`Error: The destination ${args.new_path} already exists`);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  return done(`Successfully renamed ${args.old_path} to ${args.new_path}`);
}

const COMMANDS = {
  view: cmdView,
  create: cmdCreate,
  str_replace: cmdStrReplace,
  insert: cmdInsert,
  delete: cmdDelete,
  rename: cmdRename,
};

/** Só `view` não muda nada — usado para não encher o log de auditoria de leitura. */
export const READ_ONLY_MEMORY_COMMANDS = new Set(['view']);

/**
 * Executa um comando da memory tool. Nunca lança: erro de disco vira texto de
 * erro para o modelo, porque uma exceção aqui derrubaria o turno inteiro por
 * causa de uma anotação que não conseguiu ser salva.
 */
export function runMemoryCommand(args = {}, userId = DEFAULT_USER) {
  const handler = COMMANDS[args.command];
  if (!handler) return fail(`Error: unknown command ${args.command}`);
  try {
    return handler(args, userId);
  } catch (err) {
    return fail(`Error: ${err.message}`);
  }
}

// ── Perfil sempre carregado ──────────────────────────────────────────────────

/**
 * Conteúdo de `perfil.md` para injetar no contexto, cortado em
 * MAX_PROFILE_CHARS. Retorna null quando não existe — o bloco inteiro some do
 * prompt em vez de mandar "vazio", que só gastaria token dizendo nada.
 */
export function readProfile(userId = DEFAULT_USER) {
  try {
    const target = realPath(PROFILE_PATH, userId);
    if (!target || !existsSync(target)) return null;
    const content = readFileSync(target, 'utf8').trim();
    if (!content) return null;
    return content.length > MAX_PROFILE_CHARS
      ? `${content.slice(0, MAX_PROFILE_CHARS)}\n… (perfil cortado — abra ${PROFILE_PATH} com a ferramenta memory para ler o resto)`
      : content;
  } catch {
    return null;
  }
}

// ── Migração da memória antiga ───────────────────────────────────────────────

const LEGACY_KEY = 'jarvis.memories';

/**
 * Move os fatos de `jarvis.memories` para `perfil.md` e apaga a chave antiga.
 *
 * Roda uma vez, no boot. Apagar a chave é o que garante isso: enquanto ela
 * existir a migração se repete, e depois que ela some não há nada para migrar
 * de novo. Se `perfil.md` já tiver conteúdo, os fatos são ANEXADOS — reescrever
 * apagaria o que o modelo escreveu com a tool nova.
 */
export function migrateLegacyMemories(userId = DEFAULT_USER) {
  const raw = kvStore.get(LEGACY_KEY);
  if (!raw) return { migrated: 0 };

  let facts = [];
  try { facts = JSON.parse(raw) ?? []; } catch { facts = []; }

  if (facts.length > 0) {
    const linhas = facts
      .map((m) => `- ${m.fact}${m.createdAt ? ` (registrado em ${String(m.createdAt).slice(0, 10)})` : ''}`)
      .join('\n');
    const bloco = `## Fatos duradouros\n\n${linhas}\n`;
    const target = realPath(PROFILE_PATH, userId);
    const anterior = target && existsSync(target) ? readFileSync(target, 'utf8').trimEnd() : '';
    const conteudo = anterior ? `${anterior}\n\n${bloco}` : bloco;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, conteudo, 'utf8');
  }

  kvStore.delete(LEGACY_KEY);
  return { migrated: facts.length };
}
