/**
 * authorize-google.js
 * Autoriza todos os escopos Google necessários pelo Hub Pessoal de uma vez:
 *   - Gmail (nubank-invoice-gmail-sync.js)
 *   - Drive  (gdrive-backup.js, gdrive-materials-sync.js)
 *   - Calendar (calendar-sync.js)
 *
 * Uso: node scripts/sync/authorize-google.js
 * Salva o token em scripts/config/token.json (substitui o existente).
 */

import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { GOOGLE_SCOPES, TOKEN_PATH, createOAuthClient, saveToken } from '../../server/google.js';

const OPERA_PATH    = 'C:\\Users\\Bernardo\\AppData\\Local\\Programs\\Opera GX\\opera.exe';
const REDIRECT_PORT = 3737;
const REDIRECT_URI  = `http://localhost:${REDIRECT_PORT}`;

let oAuth2Client;
let key;
try {
  ({ client: oAuth2Client, key } = createOAuthClient(REDIRECT_URI));
} catch (err) {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
}

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: GOOGLE_SCOPES,
  prompt: 'consent',
});

console.log('');
console.log('Abrindo navegador para autorização Google...');
console.log('Escopos: Gmail + Drive + Calendar');
console.log('');

try { execSync(`"${OPERA_PATH}" "${authUrl}"`, { stdio: 'ignore', detached: true }); }
catch { console.log('Abra manualmente no navegador:'); console.log(authUrl); }

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url   = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
    const code  = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (error) { res.end('Autorização negada.'); server.close(); reject(new Error(error)); return; }
    if (code)  { res.end('✅ Autorizado! Pode fechar esta aba.'); server.close(); resolve(code); }
    else         res.end('Aguardando...');
  });
  server.listen(REDIRECT_PORT, () => console.log(`Aguardando callback na porta ${REDIRECT_PORT}...`));
  server.on('error', reject);
  setTimeout(() => { server.close(); reject(new Error('Timeout: 2 minutos')); }, 120_000);
});

const { tokens } = await oAuth2Client.getToken(code);
oAuth2Client.setCredentials(tokens);

saveToken(key, oAuth2Client.credentials.refresh_token);

console.log('');
console.log(`✅ Token salvo em ${TOKEN_PATH}`);
console.log('   Escopos autorizados: Gmail + Drive + Calendar');
console.log('   Todos os scripts do Hub podem usar este token.');
console.log('');
