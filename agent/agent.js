/**
 * agent/agent.js — as "mãos" locais do Jarvis.
 *
 * Roda em cada máquina que deve obedecer comandos físicos (abrir app,
 * controlar mídia). CONECTA ao Hub e fica esperando trabalho — não escuta em
 * porta nenhuma.
 *
 * Por que a conexão é de saída: uma máquina atrás do roteador de casa não tem
 * endereço para ser chamada de fora. Escutando numa porta, isto só funcionava
 * com as duas pontas no mesmo tailnet. Conectando para fora, funciona em
 * qualquer rede — inclusive com o notebook no 4G — sem abrir porta, e a
 * autorização deixa de ser "de que IP veio" (que a inversão torna
 * impossível de checar de qualquer forma) e passa a ser a credencial que o
 * agente apresenta.
 *
 * Segurança em duas camadas:
 *   1. Só o dono do AGENT_TOKEN consegue buscar comando ou devolver resultado.
 *   2. Allowlist rígida: nunca executa comando arbitrário.
 *
 * Rodar (PM2):
 *   pm2 start agent/agent.js --name hub-agent --node-args="--env-file=.env"
 *
 * Variáveis: AGENT_TOKEN (obrigatória), HUB_URL (padrão: localhost:3001),
 * AGENT_DEVICE_ID (padrão: hostname da máquina).
 */

import { exec } from 'node:child_process';
import { hostname } from 'node:os';

const TOKEN = process.env.AGENT_TOKEN;
const HUB_URL = (process.env.HUB_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const DEVICE_ID = process.env.AGENT_DEVICE_ID ?? hostname();

if (!TOKEN) {
  console.error('[agent] AGENT_TOKEN ausente no ambiente — abortando.');
  process.exit(1);
}

// ── Allowlist de aplicativos (edite aqui para adicionar apps) ─────────────────
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? '';
const APPS = {
  navegador:   'start "" chrome',
  chrome:      'start "" chrome',
  vscode:      `start "" "${LOCALAPPDATA}\\Programs\\Microsoft VS Code\\Code.exe"`,
  steam:       'start "" "C:\\Program Files (x86)\\Steam\\steam.exe"',
  discord:     `start "" "${LOCALAPPDATA}\\Discord\\Update.exe" --processStart Discord.exe`,
  explorer:    'start "" explorer',
  calculadora: 'start "" calc',
  spotify:     'start "" spotify:',
};

// Teclas de mídia via keybd_event (SendKeys não cobre teclas de mídia).
const MEDIA_VK = {
  playpause:   0xB3,
  next:        0xB0,
  prev:        0xB1,
  volume_up:   0xAF,
  volume_down: 0xAE,
  mute:        0xAD,
};

function pressMediaKey(vk, times) {
  const ps = [
    "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, int dwExtraInfo);' -Name K -Namespace W;",
    `1..${times} | ForEach-Object { [W.K]::keybd_event(${vk},0,0,0); [W.K]::keybd_event(${vk},0,2,0); Start-Sleep -Milliseconds 40 }`,
  ].join(' ');
  return new Promise((resolve, reject) => {
    exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, (err) =>
      err ? reject(err) : resolve());
  });
}

function runShell(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: 'cmd.exe', windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Executa e DEVOLVE a saída — diferente do runShell, que só dispara.
 *
 * Um comando que falha não é erro do agente: o modelo precisa ler o stderr
 * para entender o que houve, então saída e código de saída voltam nos dois
 * casos. Truncado porque a saída vira token no prompt do modelo, e um `ls -R`
 * numa pasta grande custaria caro sem acrescentar nada.
 */
function execCapture(command) {
  const MAX_OUTPUT = 4000;
  return new Promise((resolve) => {
    exec(
      command,
      { shell: 'cmd.exe', windowsHide: true, timeout: 45_000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const cut = (s) => {
          const t = (s ?? '').toString().trim();
          return t.length > MAX_OUTPUT ? `${t.slice(0, MAX_OUTPUT)}\n…(saída truncada)` : t;
        };
        const out = cut(stdout);
        const errOut = cut(stderr);
        const parts = [out && `saída:\n${out}`, errOut && `erros:\n${errOut}`].filter(Boolean);
        resolve({
          ok: !err,
          exitCode: err?.code ?? 0,
          message: parts.join('\n\n') || (err ? `Falhou: ${err.message}` : 'Comando executado, sem saída.'),
        });
      },
    );
  });
}

async function handleAction(body) {
  const { action } = body ?? {};

  if (action === 'open_app') {
    const cmd = APPS[body.app];
    if (!cmd) return { ok: false, error: `App "${body.app}" não está na allowlist. Disponíveis: ${Object.keys(APPS).join(', ')}` };
    await runShell(cmd);
    return { ok: true, message: `${body.app} aberto no notebook.` };
  }

  if (action === 'open_url') {
    const url = String(body.url ?? '');
    // O `%` sai junto com aspas/espaços/<>: o cmd.exe expande %VARIAVEL% mesmo
    // dentro de aspas, então uma URL tipo https://site/?x=%USERPROFILE% abriria
    // o navegador já com o valor da variável embutido — vazamento silencioso pro
    // dono do site. O Jarvis monta essas URLs a partir de texto que nem sempre
    // é confiável.
    if (!/^https?:\/\/[^\s"'<>%^|&]+$/.test(url)) {
      return { ok: false, error: 'URL inválida (só http/https, sem espaços, aspas ou caracteres de shell).' };
    }
    await runShell(`start "" "${url}"`);
    return { ok: true, message: 'URL aberta no navegador do notebook.' };
  }

  if (action === 'exec') {
    // Sem allowlist aqui de propósito: o que decide se este comando podia rodar
    // é o Hub — ou ele estava na lista de auto-aprovados, ou o Bernardo clicou
    // em aprovar vendo o texto exato. Repetir a allowlist aqui daria a falsa
    // impressão de uma segunda barreira, quando na prática o agente já confia
    // em quem apresenta o AGENT_TOKEN.
    const command = String(body.command ?? '').trim();
    if (!command) return { ok: false, error: 'Comando vazio.' };
    return await execCapture(command);
  }

  if (action === 'media') {
    const vk = MEDIA_VK[body.control];
    if (!vk) return { ok: false, error: `Controle "${body.control}" inválido. Disponíveis: ${Object.keys(MEDIA_VK).join(', ')}` };
    const times = body.control.startsWith('volume') ? 5 : 1;
    await pressMediaKey(vk, times);
    return { ok: true, message: `Controle de mídia "${body.control}" enviado.` };
  }

  return { ok: false, error: `Ação desconhecida: ${action}` };
}

// ── Laço de conexão ──────────────────────────────────────────────────────────

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function sendResult(commandId, result) {
  try {
    await fetch(`${HUB_URL}/api/agent/result`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ commandId, result }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    // O pedido do outro lado vai expirar sozinho; perder o resultado é ruim
    // mas não trava nada.
    console.error('[agent] falha ao devolver resultado:', err.message);
  }
}

/** Backoff só para falha de conexão — poll vazio é operação normal, não erro. */
let backoffMs = 1_000;
const MAX_BACKOFF_MS = 30_000;

async function loop() {
  for (;;) {
    try {
      const res = await fetch(`${HUB_URL}/api/agent/poll?deviceId=${encodeURIComponent(DEVICE_ID)}`, {
        headers,
        // Acima do long-poll do servidor (25s), senão o cliente desiste antes
        // de o servidor responder e toda espera vira erro de rede.
        signal: AbortSignal.timeout(40_000),
      });

      if (res.status === 401) {
        console.error('[agent] token rejeitado pelo Hub — confira AGENT_TOKEN nas duas pontas.');
        await new Promise((r) => setTimeout(r, MAX_BACKOFF_MS));
        continue;
      }

      backoffMs = 1_000;
      if (res.status === 204) continue; // nada a fazer, reabre o poll

      const { command } = await res.json();
      if (!command) continue;

      console.log(`[agent] comando ${command.id}: ${command.action?.action}`);
      let result;
      try {
        result = await handleAction(command.action);
      } catch (err) {
        result = { ok: false, error: err.message ?? 'Falha ao executar.' };
      }
      await sendResult(command.id, result);
    } catch (err) {
      console.error(`[agent] sem conexão com o Hub (${err.message}) — nova tentativa em ${backoffMs / 1000}s.`);
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  }
}

console.log(`[agent] mãos do Jarvis conectando em ${HUB_URL} como "${DEVICE_ID}"...`);
loop();
