/**
 * jarvis-check.js — sanity check do Jarvis.
 *
 * Cobre a fronteira de confiança (modo cauteloso) e a resolução de config,
 * que são as duas partes onde uma regressão silenciosa custa caro: a primeira
 * é a única proteção contra injeção de prompt que não depende do modelo se
 * comportar, e a segunda decide modelo e gasto de toda chamada.
 *
 * Rodar: node scripts/jarvis-check.js  (ou npm test)
 */

import assert from 'node:assert';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EXTERNAL_CONTENT_TOOLS,
  IRREVERSIBLE_TOOLS,
  newTurnState,
  executeToolAudited,
  getJarvisTools,
  getTickTools,
  getActionTools,
} from '../server/jarvis/tools/index.js';
import { GOOGLE_TOOL_NAMES, GOOGLE_WRITE_TOOL_NAMES, describeGoogleWrite } from '../server/jarvis/tools/google.js';
import { executeMemoryTool } from '../server/jarvis/tools/memory.js';
import { runMemoryCommand } from '../server/jarvis/memoryStore.js';
import { PRESETS, agentParamsFor, modelCaps, webEnabledFor } from '../server/jarvis/config.js';
import { markExternalContent } from '../server/jarvis/agent.js';

// ── Fronteira de confiança ───────────────────────────────────────────────────
// Simula uma tool externa usando uma que já existe e é inofensiva: assim o
// teste não depende de as tools de web/Google já estarem implementadas.
EXTERNAL_CONTENT_TOOLS.add('get_weather');
IRREVERSIBLE_TOOLS.add('get_weather');

const turn = newTurnState();
assert.equal(turn.tainted, false, 'turno deve nascer limpo');

const externo = await executeToolAudited('get_weather', {}, turn);
assert.equal(turn.tainted, true, 'ler conteúdo externo deve contaminar o turno');
assert.ok(turn.taintedBy.includes('get_weather'), 'deve registrar qual tool contaminou');
assert.equal(externo._untrusted, true, 'resultado externo deve vir marcado como não confiável');
assert.ok(
  typeof externo._origem === 'string' && externo._origem.includes('não instrução'),
  'resultado externo deve carregar o aviso de que é dado, não instrução',
);

const bloqueado = await executeToolAudited('get_weather', {}, turn);
assert.equal(
  bloqueado.blockedByCautiousMode, true,
  'ação irreversível DEPOIS de ler conteúdo externo deve ser bloqueada — em qualquer nível de acesso',
);

// Isolamento: o servidor atende requisições concorrentes, então a marca não
// pode ser global. Um turno novo não herda a contaminação de outro.
const outroTurno = newTurnState();
const liberado = await executeToolAudited('get_weather', {}, outroTurno);
assert.equal(
  liberado.blockedByCautiousMode, undefined,
  'turno novo não pode herdar a contaminação de um turno anterior',
);

// Chamada sem turno (caminho de compatibilidade) não pode explodir.
const semTurno = await executeToolAudited('get_weather', {});
assert.equal(semTurno.blockedByCautiousMode, undefined, 'sem turno, não bloqueia');

EXTERNAL_CONTENT_TOOLS.delete('get_weather');
IRREVERSIBLE_TOOLS.delete('get_weather');

// ── Contaminação por tool SERVER-SIDE ────────────────────────────────────────
// web_search e web_fetch nunca passam por executeToolAudited: rodam na infra da
// Anthropic e voltam já resolvidas dentro do content da resposta. Sem esta
// varredura no runAgent, o modo cauteloso ficaria inerte exatamente para a
// ferramenta que é a porta de entrada mais óbvia de uma injeção de prompt.
// Os blocos abaixo têm a forma real observada numa chamada de verdade:
// server_tool_use -> web_search_tool_result -> text.
const turnoWeb = newTurnState();
markExternalContent(
  [
    { type: 'server_tool_use', name: 'web_search' },
    { type: 'web_search_tool_result', content: [{ title: 'exemplo' }] },
    { type: 'text', text: 'resposta' },
  ],
  turnoWeb,
);
assert.equal(turnoWeb.tainted, true, 'web_search_tool_result deve contaminar o turno');
assert.ok(turnoWeb.taintedBy.includes('web_search'), 'deve registrar web_search como origem');

const turnoFetch = newTurnState();
markExternalContent([{ type: 'web_fetch_tool_result', content: {} }], turnoFetch);
assert.equal(turnoFetch.tainted, true, 'web_fetch_tool_result deve contaminar o turno');

const turnoLimpo = newTurnState();
markExternalContent([{ type: 'text', text: 'oi' }, { type: 'tool_use', name: 'get_budget_status' }], turnoLimpo);
assert.equal(turnoLimpo.tainted, false, 'resposta sem conteúdo externo não pode contaminar');

// E o efeito prático: depois de contaminado, ação na máquina não executa.
const bloqueadoPelaWeb = await executeToolAudited('run_on_machine', { command: 'git status', why: 'x' }, turnoWeb);
assert.equal(
  bloqueadoPelaWeb.blockedByCautiousMode, true,
  'run_on_machine deve ser bloqueado depois de uma busca na web no mesmo turno',
);

// ── Config: parâmetros válidos por modelo ────────────────────────────────────
for (const [nome, preset] of Object.entries(PRESETS)) {
  const cfg = { ...preset, preset: nome, budget: {} };

  for (const superficie of ['chat', 'tick', 'task']) {
    const p = agentParamsFor(superficie, cfg);
    assert.ok(p.maxIters > 0, `${nome}/${superficie}: maxIters obrigatório`);
    assert.ok(p.maxTokens > 0, `${nome}/${superficie}: maxTokens obrigatório`);

    // Mandar effort para um modelo que não aceita é 400, não degradação.
    if (!modelCaps(cfg[superficie].model).effort) {
      assert.equal(
        p.outputConfig, undefined,
        `${nome}/${superficie}: modelo sem suporte a effort não pode receber output_config`,
      );
    }
  }

  // Web no chat só quando o modelo do chat suporta as variantes atuais.
  if (cfg.capabilities.web === 'all' && !modelCaps(cfg.chat.model).webToolsV2) {
    assert.equal(webEnabledFor('chat', cfg), false, `${nome}: web não pode ligar num chat que não suporta`);
  }
}

// ── Composição de tools ──────────────────────────────────────────────────────
for (const [nome, preset] of Object.entries(PRESETS)) {
  const cfg = { ...preset, preset: nome, budget: {} };

  for (const [rotulo, lista] of [
    ['chat', getJarvisTools(cfg)],
    ['tick', getTickTools(cfg)],
    ['task', getActionTools(cfg)],
  ]) {
    // A API rejeita defer_loading + cache_control na mesma tool.
    assert.equal(
      lista.filter((t) => t.defer_loading && t.cache_control).length, 0,
      `${nome}/${rotulo}: tool diferida não pode carregar cache_control`,
    );
    // No máximo uma âncora, senão gasta breakpoint à toa.
    assert.ok(
      lista.filter((t) => t.cache_control).length <= 1,
      `${nome}/${rotulo}: no máximo uma âncora de cache`,
    );
    // A busca de tools nunca pode ser diferida — é ela que acha o resto.
    const busca = lista.find((t) => t.type?.startsWith('tool_search_tool'));
    if (busca) assert.ok(!busca.defer_loading, `${nome}/${rotulo}: a busca de tools não pode ser diferida`);
    // Se há tool diferida, tem que haver a busca — senão ela fica inalcançável.
    if (lista.some((t) => t.defer_loading)) {
      assert.ok(busca, `${nome}/${rotulo}: há tool diferida sem busca de tools na lista`);
    }
  }

  // Tick só ancora quando o intervalo cabe na janela de 1h do cache.
  const tick = getTickTools(cfg);
  const ancorado = tick.some((t) => t.cache_control);
  assert.equal(
    ancorado, cfg.tick.intervalMinutes < 60,
    `${nome}: tick de ${cfg.tick.intervalMinutes}min ${cfg.tick.intervalMinutes < 60 ? 'deveria' : 'não deveria'} ancorar cache`,
  );
}

// ── Google: capacidade e superfícies (Fase 10) ───────────────────────────────
// Três coisas que uma regressão silenciosa quebraria sem ninguém notar: o gate
// de capacidade, a ausência no tick e a marcação como conteúdo externo.
const nomes = (lista) => new Set(lista.map((t) => t.name));

for (const [nome, preset] of Object.entries(PRESETS)) {
  const ligado = { ...preset, preset: nome, budget: {} };
  const desligado = {
    ...ligado,
    capabilities: { ...ligado.capabilities, google: { read: false, write: false } },
  };

  for (const tool of GOOGLE_TOOL_NAMES) {
    assert.ok(
      nomes(getJarvisTools(ligado)).has(tool),
      `${nome}: ${tool} deveria estar no chat com google.read ligado`,
    );
    assert.ok(
      !nomes(getJarvisTools(desligado)).has(tool),
      `${nome}: ${tool} não pode aparecer no chat com google.read desligado`,
    );
    assert.ok(
      nomes(getActionTools(ligado)).has(tool),
      `${nome}: ${tool} deveria estar disponível numa tarefa delegada`,
    );
    assert.ok(
      !nomes(getActionTools(desligado)).has(tool),
      `${nome}: ${tool} não pode aparecer na tarefa com google.read desligado`,
    );
    // O tick nunca recebe Google, nem com a capacidade ligada: gasta token sem
    // pedido e nasceria contaminado, sem poder agir na máquina depois.
    assert.ok(
      !nomes(getTickTools(ligado)).has(tool),
      `${nome}: ${tool} não pode entrar no tick proativo`,
    );
  }
}

for (const tool of GOOGLE_TOOL_NAMES) {
  assert.ok(
    EXTERNAL_CONTENT_TOOLS.has(tool),
    `${tool} traz conteúdo de fora e precisa estar em EXTERNAL_CONTENT_TOOLS`,
  );
}

// ── Google: escrita sempre com aprovação (Fase 11) ───────────────────────────
// Nenhuma asserção aqui chega a enfileirar nada: só caminhos que param antes
// (capacidade desligada, turno contaminado) e checagem de conjunto. Enfileirar
// de verdade gravaria pendência no banco local e dispararia push.
for (const [nome, preset] of Object.entries(PRESETS)) {
  const ligado = {
    ...preset,
    preset: nome,
    budget: {},
    capabilities: { ...preset.capabilities, google: { read: true, write: true } },
  };
  const semEscrita = {
    ...ligado,
    capabilities: { ...ligado.capabilities, google: { read: true, write: false } },
  };

  for (const tool of GOOGLE_WRITE_TOOL_NAMES) {
    assert.ok(
      nomes(getJarvisTools(ligado)).has(tool),
      `${nome}: ${tool} deveria estar no chat com google.write ligado`,
    );
    assert.ok(
      !nomes(getJarvisTools(semEscrita)).has(tool),
      `${nome}: ${tool} não pode aparecer com google.write desligado`,
    );
    // Ler pode ser autônomo; escrever nunca — o tick não recebe nem a chance.
    assert.ok(
      !nomes(getTickTools(ligado)).has(tool),
      `${nome}: ${tool} não pode entrar no tick proativo`,
    );
  }
}

for (const tool of GOOGLE_WRITE_TOOL_NAMES) {
  assert.ok(
    IRREVERSIBLE_TOOLS.has(tool),
    `${tool} manda coisa para fora e precisa estar em IRREVERSIBLE_TOOLS`,
  );
  // O efeito prático: depois de ler e-mail/página, escrever não sai sozinho.
  // É a defesa contra "o e-mail mandou responder para este outro endereço".
  const turnoSujo = newTurnState();
  turnoSujo.tainted = true;
  turnoSujo.taintedBy = ['read_email'];
  const barrado = await executeToolAudited(tool, {}, turnoSujo);
  assert.equal(
    barrado.blockedByCautiousMode, true,
    `${tool} deve ser bloqueada num turno que já leu conteúdo externo`,
  );
}

// O texto da aprovação precisa ser VERBATIM. Se algum dia alguém resumir o
// corpo aqui "pra caber melhor no painel", a fila deixa de proteger: aprovar
// passaria a ser confiar na descrição que o modelo deu de si mesmo.
const corpoDoEmail = 'Prezado professor,\n\nSegue o trabalho em anexo.\n\nBernardo';
const previaEmail = describeGoogleWrite('send_email', {
  to: 'professor@ifsc.edu.br',
  subject: 'Entrega do trabalho',
  body: corpoDoEmail,
  why: 'ele pediu',
});
assert.ok(previaEmail.includes(corpoDoEmail), 'a prévia do e-mail deve conter o corpo inteiro, sem resumo');
assert.ok(previaEmail.includes('professor@ifsc.edu.br'), 'a prévia do e-mail deve mostrar o destinatário');
assert.ok(previaEmail.includes('Entrega do trabalho'), 'a prévia do e-mail deve mostrar o assunto');

const previaEvento = describeGoogleWrite('create_calendar_event', { title: 'Prova de Cálculo', date: '2026-09-01', why: 'x' });
assert.ok(previaEvento.includes('dia inteiro'), 'evento sem horário deve ser descrito como dia inteiro');

// run_sync fora do conjunto é decisão, não esquecimento: roda script fixo do
// repo, não manda nada para fora, e já exige aprovação.
assert.ok(!IRREVERSIBLE_TOOLS.has('run_sync'), 'run_sync não deve entrar em IRREVERSIBLE_TOOLS');
assert.ok(
  !nomes(getTickTools({ ...PRESETS.medio, preset: 'medio', budget: {} })).has('run_sync'),
  'run_sync não pode entrar no tick proativo',
);

// ── Memória em arquivo (Fase 12) ─────────────────────────────────────────────
// Duas coisas para não regredir: o modelo não pode sair de /memories (é o
// único isolamento entre a memória e o resto do disco do servidor), e a
// ferramenta não pode entrar no tick (ver o comentário em getTickTools).

const USUARIO_TESTE = '__check__';
const raizTeste = resolve(process.cwd(), 'jarvis-memory', USUARIO_TESTE);
const mem = (args) => runMemoryCommand(args, USUARIO_TESTE);

for (const caminho of [
  '/memories/../../.env',
  '/memories/../hub.db',
  '/etc/passwd',
  'memories/perfil.md',
  '/memories/%2e%2e%2f%2e%2e%2f.env',
  '/memories/..\\..\\.env',
  '/memoriesx/perfil.md',
]) {
  const r = mem({ command: 'view', path: caminho });
  assert.equal(r.ok, false, `caminho fora de /memories deve ser recusado: ${caminho}`);
}

// Ciclo completo dos seis comandos.
assert.ok(mem({ command: 'create', path: '/memories/perfil.md', file_text: 'linha um\nlinha dois\n' }).ok);

const lido = mem({ command: 'view', path: '/memories/perfil.md' });
assert.ok(lido.ok && lido.text.includes('     1\tlinha um'), 'view deve numerar as linhas em 6 colunas com tab');

const listado = mem({ command: 'view', path: '/memories' });
assert.ok(listado.ok && listado.text.includes('/memories/perfil.md'), 'view do diretório deve listar os arquivos');

assert.ok(mem({ command: 'str_replace', path: '/memories/perfil.md', old_str: 'linha um', new_str: 'linha 1' }).ok);
assert.equal(
  mem({ command: 'str_replace', path: '/memories/perfil.md', old_str: 'inexistente', new_str: 'x' }).ok, false,
  'str_replace sem casar deve falhar em vez de escrever',
);
assert.ok(mem({ command: 'insert', path: '/memories/perfil.md', insert_line: 0, insert_text: 'topo' }).ok);
assert.equal(
  mem({ command: 'insert', path: '/memories/perfil.md', insert_line: 999, insert_text: 'x' }).ok, false,
  'insert fora do arquivo deve falhar',
);
assert.ok(mem({ command: 'rename', old_path: '/memories/perfil.md', new_path: '/memories/velho.md' }).ok);
assert.ok(mem({ command: 'delete', path: '/memories/velho.md' }).ok);
assert.equal(mem({ command: 'view', path: '/memories/velho.md' }).ok, false, 'arquivo apagado não deve mais existir');

// A raiz é intocável — a própria descrição da tool diz isso ao modelo, mas
// prompt não é controle de acesso.
assert.equal(mem({ command: 'delete', path: '/memories' }).ok, false, 'a raiz /memories não pode ser apagada');
assert.equal(mem({ command: 'rename', old_path: '/memories', new_path: '/memories2' }).ok, false, 'a raiz /memories não pode ser renomeada');
assert.equal(mem({ command: 'inventado' }).ok, false, 'comando desconhecido deve falhar sem lançar');

rmSync(raizTeste, { recursive: true, force: true });

// A memória é um dial: entra no chat e na tarefa quando ligada, some quando
// desligada, e nunca aparece no tick.
for (const [nome, preset] of Object.entries(PRESETS)) {
  const ligado = { ...preset, preset: nome, budget: {}, capabilities: { ...preset.capabilities, memoryTool: true } };
  const desligado = { ...ligado, capabilities: { ...ligado.capabilities, memoryTool: false } };
  const temMemoria = (lista) => lista.some((t) => t.type === 'memory_20250818');

  assert.ok(temMemoria(getJarvisTools(ligado)), `${nome}: memory tool deveria estar no chat com a memória ligada`);
  assert.ok(temMemoria(getActionTools(ligado)), `${nome}: memory tool deveria estar na tarefa delegada`);
  assert.ok(!temMemoria(getJarvisTools(desligado)), `${nome}: memory tool não pode aparecer com a memória desligada`);
  assert.ok(!temMemoria(getActionTools(desligado)), `${nome}: memory tool não pode aparecer na tarefa com a memória desligada`);
  assert.ok(!temMemoria(getTickTools(ligado)), `${nome}: memory tool não pode entrar no tick (protocolo injetado custa uma chamada por tick)`);
  // Cache: a memory tool é definida pela Anthropic e não pode virar âncora nem
  // ser diferida — as duas coisas quebrariam a requisição.
  for (const t of getJarvisTools(ligado).filter((x) => x.type === 'memory_20250818')) {
    assert.ok(!t.defer_loading, `${nome}: a memory tool não pode ser diferida`);
    assert.ok(!t.cache_control, `${nome}: a memory tool não pode carregar a âncora de cache`);
  }
}

// O resultado volta como TEXTO (`_text`), não JSON — é o que o agent.js usa
// para decidir o formato do tool_result. E `view` não pode gerar auditoria.
const resView = await executeMemoryTool('memory', { command: 'view', path: '/memories' });
assert.equal(typeof resView._text, 'string', 'a memory tool deve devolver texto cru em _text');
assert.equal(resView.readOnly, true, 'view é leitura e não deve entrar no log de auditoria');
const resWrite = await executeMemoryTool('memory', { command: 'create', path: '/memories/x.md', file_text: 'a' });
assert.equal(resWrite.readOnly, false, 'create é escrita e precisa ser auditada');
runMemoryCommand({ command: 'delete', path: '/memories/x.md' });

// As tools antigas foram substituídas, não apenas escondidas.
for (const antiga of ['remember_fact', 'forget_fact']) {
  assert.equal(
    (await executeToolAudited(antiga, {})).error, `Tool desconhecida: ${antiga}`,
    `${antiga} deveria ter sumido junto com a memória antiga`,
  );
}

console.log('Jarvis check passed.');
