/**
 * sigaa-unlock.mjs — run from the NOTEBOOK when the SIGAA anti-bot blocks the
 * server's sync (push "SIGAA pediu captcha"). `npm run sigaa:unlock`.
 *
 * Opens an ssh tunnel to the server (port 9333, server-local DevTools) and runs
 * the sync there in --unlock mode. Open chrome://inspect in Chrome on the
 * notebook (Configure → localhost:9333 once), click "inspect" under the
 * "Radware Captcha Page" target and solve it; the sync goes on by itself and the
 * server's browser profile keeps the pass for the scheduled runs.
 *
 * Uses the `desktop` host from ~/.ssh/config.
 * Never run sigaa-sync itself on the notebook — the login must leave from the
 * server's network, which is what the pass is tied to.
 */

import { spawn } from 'node:child_process';

const userId = process.argv[2] ?? '1';

console.log(`
[sigaa-unlock] Abrindo o túnel e rodando o sync no servidor (usuário ${userId}).
[sigaa-unlock] No Chrome do notebook: chrome://inspect/#devices
               (uma vez só: Configure… → localhost:9333 → Done)
[sigaa-unlock] Quando aparecer "Radware Captcha Page", clique em inspect e resolva.
               Você tem 5 minutos. Se o captcha não aparecer, o sync segue sozinho.
`);

// The server's ssh shell is Windows PowerShell 5.1, where `&&` is a parse error
// (it used to be cmd). Naming powershell explicitly works whichever shell sshd
// hands us; its exit code is 1 when the sync's is non-zero.
const remote = `powershell -NoProfile -Command "Set-Location Hub-Pessoal; node --env-file=.env scripts/sync/sigaa-sync.js --user ${userId} --unlock"`;
const child = spawn('ssh', ['-o', 'ExitOnForwardFailure=yes', '-L', '9333:127.0.0.1:9333', 'desktop', remote], { stdio: 'inherit' });
child.on('exit', (code) => {
  console.log(code === 0
    ? '\n[sigaa-unlock] Pronto — o SIGAA sincronizou.'
    : `\n[sigaa-unlock] O sync terminou com erro (código ${code}). Veja a mensagem acima.`);
  process.exit(code ?? 1);
});
