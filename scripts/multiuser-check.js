/**
 * multiuser-check.js — isolamento entre usuários (F1 do multiusuário).
 *
 * É o teste que precisa passar antes de qualquer pessoa além do dono entrar:
 * o servidor vai guardar e-mail e dado bancário de amigos e família, e um
 * vazamento entre usuários não se desfaz.
 *
 * Roda num banco descartável criado no formato ANTIGO (usuário único), para
 * exercitar também a migração que o deploy executa em produção.
 *
 * Rodar: node scripts/multiuser-check.js  (ou npm test)
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import forge from 'node-forge';

const dir = mkdtempSync(join(tmpdir(), 'hub-multiuser-'));
const dbPath = join(dir, 'hub.db');

// ─── Banco no formato de usuário único, como o de produção antes do deploy ───
const legacy = new DatabaseSync(dbPath);
legacy.exec(`
  CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE material_content (material_id TEXT PRIMARY KEY, text TEXT NOT NULL, extracted_at TEXT NOT NULL);
  CREATE TABLE secrets (name TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE project_files (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, front_id TEXT, file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, storage_path TEXT NOT NULL, created_at TEXT NOT NULL
  );
  INSERT INTO kv_store VALUES ('finance.transactions', '[{"id":"t1","amount":-42}]');
  INSERT INTO kv_store VALUES ('projects.list', '[{"id":"project-1","name":"Hub"}]');
  INSERT INTO material_content VALUES ('mat-1', 'texto do dono', '2026-01-01T00:00:00Z');
  INSERT INTO secrets VALUES ('ai.key.principal', 'cifrado-do-dono');
  INSERT INTO project_files VALUES ('pfile-1', 'project-1', NULL, 'a.pdf', 'application/pdf', 3, '/x/a.pdf', '2026-01-01T00:00:00Z');
`);
legacy.close();

// ─── Cloudflare de mentira: assina o CSR com uma CA de teste e anota revogações ──
const mockCaKeys = forge.pki.rsa.generateKeyPair(1024);
const mockCa = forge.pki.createCertificate();
mockCa.publicKey = mockCaKeys.publicKey;
mockCa.serialNumber = '01';
mockCa.validity.notBefore = new Date('2026-01-01T00:00:00Z');
mockCa.validity.notAfter = new Date('2036-01-01T00:00:00Z');
mockCa.setSubject([{ name: 'commonName', value: 'Mock Cloudflare CA' }]);
mockCa.setIssuer(mockCa.subject.attributes);
mockCa.sign(mockCaKeys.privateKey, forge.md.sha256.create());
const cloudflareRevoked = [];
const cloudflareMock = createServer((req, res) => {
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.headers.authorization !== 'Bearer token-de-teste') return send(403, { success: false, errors: [{ message: 'token inválido' }] });
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/zones/zona-teste/client_certificates') {
      const { csr: csrPem, validity_days: days } = JSON.parse(raw);
      const csr = forge.pki.certificationRequestFromPem(csrPem);
      const cert = forge.pki.createCertificate();
      cert.publicKey = csr.publicKey;
      cert.serialNumber = '02';
      cert.validity.notBefore = new Date('2026-10-12T00:00:00Z');
      cert.validity.notAfter = new Date(Date.UTC(2026, 9, 12) + days * 86_400_000);
      cert.setSubject(csr.subject.attributes);
      cert.setIssuer(mockCa.subject.attributes);
      cert.sign(mockCaKeys.privateKey, forge.md.sha256.create());
      return send(200, { success: true, result: { id: 'cf-cert-1', certificate: forge.pki.certificateToPem(cert), status: 'active' } });
    }
    const revoke = /^\/zones\/zona-teste\/client_certificates\/(.+)$/.exec(req.url);
    if (req.method === 'DELETE' && revoke) {
      cloudflareRevoked.push(revoke[1]);
      return send(200, { success: true, result: { id: revoke[1], status: 'pending_revocation' } });
    }
    send(404, { success: false, errors: [{ message: 'not found' }] });
  });
});
await new Promise((resolve) => cloudflareMock.listen(0, '127.0.0.1', resolve));
process.env.CLOUDFLARE_API_URL = `http://127.0.0.1:${cloudflareMock.address().port}`;
process.env.CLOUDFLARE_API_TOKEN = 'token-de-teste';
process.env.CLOUDFLARE_ZONE_ID = 'zona-teste';

process.env.HUB_DB_PATH = dbPath;
process.env.HUB_UPLOADS_DIR = join(dir, 'uploads');
process.env.HUB_DATA_DIR = join(dir, 'data');
process.env.HUB_TEST = '1';
process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.FIREBASE_SERVICE_ACCOUNT_FILE = join(dir, 'sem-firebase.json');

const { kvStore, secrets, materialContent, projectFiles, users, migrateToMultiUser } = await import('../server/db.js');
const { runAsUser, OWNER_ID } = await import('../server/userContext.js');

// ─── Migração ────────────────────────────────────────────────────────────────
assert.ok(
  readdirSync(dir).some((name) => name.startsWith('hub.db.pre-multiuser-')),
  'a migração tem de gravar uma cópia do banco antes de mexer em qualquer tabela',
);
assert.equal(migrateToMultiUser(), null, 'migrar de novo não pode fazer nada (idempotente)');
assert.equal(users.get(OWNER_ID)?.is_admin, 1, 'o dono existe e é admin');

const asOwner = (fn) => runAsUser(OWNER_ID, fn);
assert.equal(asOwner(() => kvStore.get('finance.transactions')), '[{"id":"t1","amount":-42}]', 'dado antigo vira do dono');
assert.equal(asOwner(() => secrets.get('ai.key.principal')), 'cifrado-do-dono', 'segredo antigo vira do dono');
assert.equal(asOwner(() => materialContent.get('mat-1'))?.text, 'texto do dono', 'material antigo vira do dono');
assert.equal(asOwner(() => projectFiles.get('pfile-1'))?.file_name, 'a.pdf', 'anexo antigo vira do dono');

// ─── Sem contexto não existe usuário "padrão" ───────────────────────────────
assert.throws(() => kvStore.get('finance.transactions'), /fora de um contexto de usuário/, 'acesso sem usuário tem de falhar, não cair no dono');

// ─── Isolamento na camada de dados ───────────────────────────────────────────
const other = users.create({ name: 'Teste', email: 'teste@example.com' });
const asOther = (fn) => runAsUser(other.id, fn);

assert.equal(asOther(() => kvStore.get('finance.transactions')), null, 'usuário 2 não lê chave do dono');
assert.deepEqual(asOther(() => kvStore.getAll()), {}, 'usuário 2 começa sem nenhuma chave');
asOther(() => kvStore.set('finance.transactions', '[]'));
assert.equal(asOwner(() => kvStore.get('finance.transactions')), '[{"id":"t1","amount":-42}]', 'escrita do usuário 2 na mesma chave não toca a do dono');
asOther(() => kvStore.delete('projects.list'));
assert.ok(asOwner(() => kvStore.get('projects.list')), 'apagar a "mesma" chave como usuário 2 não apaga a do dono');

assert.equal(asOther(() => secrets.get('ai.key.principal')), null, 'usuário 2 não lê segredo do dono');
assert.equal(asOther(() => materialContent.get('mat-1')), null, 'usuário 2 não lê material do dono');
assert.equal(asOther(() => projectFiles.get('pfile-1')), null, 'usuário 2 não vê anexo do dono');
assert.deepEqual(asOther(() => projectFiles.listByProject('project-1')), [], 'usuário 2 não lista anexos do dono');
asOther(() => projectFiles.delete('pfile-1'));
assert.ok(asOwner(() => projectFiles.get('pfile-1')), 'usuário 2 não apaga anexo do dono');

// ─── Isolamento pela API, com a identidade resolvida de verdade ─────────────
const { app } = await import('../server/index.js');
const { writePending } = await import('../server/pendingFiles.js');
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const call = (path, { as, headers = {}, ...init } = {}) =>
  fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(as ? { 'X-Hub-User': String(as) } : {}) } });

try {
  const ownerStore = await (await call('/api/store')).json();
  assert.ok(ownerStore['projects.list'], 'sem cabeçalho de identidade, a porta privada é do dono');

  const otherStore = await (await call('/api/store', { as: other.id })).json();
  assert.equal(otherStore['projects.list'], undefined, 'GET /api/store como usuário 2 não traz chave do dono');

  await call('/api/store/goals.list', {
    as: other.id, method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: ['meta do 2'] }),
  });
  assert.equal((await call('/api/store/goals.list')).status, 404, 'chave criada pelo usuário 2 não aparece para o dono');

  assert.equal((await call('/api/logs', { as: other.id })).status, 403, 'rota só do dono recusa outro usuário');
  assert.equal((await call('/api/jarvis/config', { as: other.id })).status, 403, 'Jarvis do dono recusa outro usuário');
  assert.equal((await call('/api/logs')).status, 200, 'rota só do dono atende o dono');

  // Upload passa por express.raw (stream da requisição): o contexto do usuário
  // precisa sobreviver ao parser — se um dia não sobreviver, o upload dá 500 aqui.
  const upload = await call('/api/projects/project-2/files', {
    as: other.id, method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-File-Name': 'nota.txt' }, body: 'segredo do 2',
  });
  assert.equal(upload.status, 201, 'upload como usuário 2 funciona (contexto sobrevive ao parser de corpo cru)');
  const { id: fileId } = await upload.json();
  assert.ok(existsSync(join(dir, 'uploads', String(other.id), 'projects', 'project-2')), 'anexo vai para a pasta do usuário');
  assert.equal((await call(`/api/projects/files/${fileId}/download`)).status, 404, 'dono não baixa anexo do usuário 2');
  assert.equal((await call(`/api/projects/files/${fileId}/download`, { as: other.id })).status, 200, 'usuário 2 baixa o próprio anexo');

  // Identidade pelo tailnet: o primeiro login visto vira o do dono; outro desconhecido é recusado.
  assert.equal((await call('/api/store', { headers: { 'Tailscale-User-Login': 'dono@example.com' } })).status, 200, 'login do tailnet do dono é aceito');
  assert.equal(users.get(OWNER_ID).tailscale_login, 'dono@example.com', 'primeiro login visto é associado ao dono');
  assert.equal((await call('/api/store', { headers: { 'Tailscale-User-Login': 'intruso@example.com' } })).status, 403, 'login do tailnet sem cadastro é recusado');

  users.setTailscaleLogin(other.id, 'teste@example.com');
  const otherViaTailnet = { 'Tailscale-User-Login': 'teste@example.com' };
  assert.equal((await call('/api/store', { headers: otherViaTailnet, as: OWNER_ID })).status, 403, 'quem não é admin não pode agir como outro usuário');
  const viaTailnet = await (await call('/api/store', { headers: otherViaTailnet })).json();
  assert.deepEqual(viaTailnet['goals.list'], ['meta do 2'], 'login do tailnet cadastrado resolve para o próprio usuário');

  // ─── F2: perfil, primeiro acesso e módulos ────────────────────────────────
  const json = (body, init = {}) => ({ ...init, headers: { 'Content-Type': 'application/json', ...init.headers }, body: JSON.stringify(body) });
  const ownerMe = await (await call('/api/me')).json();
  assert.equal(ownerMe.isOwner, true, 'o dono se vê como dono');
  assert.ok(ownerMe.onboardedAt, 'o dono não passa pelo primeiro acesso — já usava o Hub antes');
  assert.equal(ownerMe.modules, null, 'sem escolha feita, todos os módulos');

  const otherMe = await (await call('/api/me', { headers: otherViaTailnet })).json();
  assert.equal(otherMe.onboardedAt, null, 'usuário novo começa pelo primeiro acesso');
  assert.equal(otherMe.isAdmin, false);
  const onboard = await call('/api/me', json({ modules: ['finance', 'study'], onboarded: true }, { method: 'PUT', headers: otherViaTailnet }));
  assert.equal(onboard.status, 200, 'usuário conclui o próprio primeiro acesso');
  const afterOnboard = await (await call('/api/me', { headers: otherViaTailnet })).json();
  assert.deepEqual(afterOnboard.modules, ['finance', 'study'], 'módulos escolhidos ficam gravados');
  assert.ok(afterOnboard.onboardedAt, 'primeiro acesso marcado como feito');
  assert.equal((await call('/api/me', json({ isAdmin: true }, { method: 'PUT', headers: otherViaTailnet }))).status, 400, 'ninguém se promove a admin pelo próprio perfil');
  assert.equal((await (await call('/api/me')).json()).modules, null, 'escolha do usuário 2 não muda os módulos do dono');

  // ─── F2: painel admin ─────────────────────────────────────────────────────
  assert.equal((await call('/api/admin/users', { headers: otherViaTailnet })).status, 403, 'quem não é admin não lista usuários');
  assert.equal((await call('/api/admin/users', json({ name: 'X' }, { method: 'POST', headers: otherViaTailnet }))).status, 403, 'quem não é admin não cria usuário');
  const list = await (await call('/api/admin/users')).json();
  assert.deepEqual(list.map((u) => u.id), [OWNER_ID, other.id], 'admin lista todos os usuários');
  assert.ok(list.every((u) => typeof u.keyCount === 'number' && !('value' in u)), 'painel mostra contagem de chaves, nunca valores');

  const created = await call('/api/admin/users', json({ name: 'Amigo', email: 'amigo@example.com' }, { method: 'POST' }));
  assert.equal(created.status, 201, 'admin cria usuário');
  const friend = await created.json();
  assert.equal((await call('/api/admin/users', json({ name: 'Dup', email: 'amigo@example.com' }, { method: 'POST' }))).status, 409, 'e-mail repetido é recusado com 409, não 500');
  assert.equal((await call(`/api/admin/users/${OWNER_ID}`, json({ disabled: true }, { method: 'PUT' }))).status, 400, 'o dono não pode ser desativado');

  await call(`/api/admin/users/${friend.id}`, json({ tailscaleLogin: 'amigo@example.com' }, { method: 'PUT' }));
  const friendViaTailnet = { 'Tailscale-User-Login': 'amigo@example.com' };
  assert.equal((await call('/api/me', { headers: friendViaTailnet })).status, 200, 'login cadastrado pelo painel entra');
  await call(`/api/admin/users/${friend.id}`, json({ disabled: true }, { method: 'PUT' }));
  assert.equal((await call('/api/store', { headers: friendViaTailnet })).status, 403, 'usuário desativado é recusado');
  await call(`/api/admin/users/${friend.id}`, json({ disabled: false }, { method: 'PUT' }));
  assert.equal((await call('/api/store', { headers: friendViaTailnet })).status, 200, 'reativar devolve o acesso');

  await call(`/api/admin/users/${other.id}`, json({ resetOnboarding: true }, { method: 'PUT' }));
  assert.equal((await (await call('/api/me', { headers: otherViaTailnet })).json()).onboardedAt, null, 'admin pode mandar o usuário refazer o primeiro acesso');
  assert.deepEqual((await (await call('/api/me', { headers: otherViaTailnet })).json()).modules, ['finance', 'study'], 'refazer o primeiro acesso não perde os módulos escolhidos');

  // ─── F2: "ver como" por cookie ────────────────────────────────────────────
  const viewAs = await call('/api/admin/view-as', json({ userId: other.id }, { method: 'POST' }));
  const setCookie = viewAs.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /hub_view_as=\d+/, 'ver como grava o cookie');
  assert.match(setCookie, /HttpOnly/i, 'cookie do ver como é HttpOnly');
  assert.match(setCookie, /SameSite=Strict/i, 'cookie do ver como é SameSite=Strict');
  const cookie = setCookie.split(';')[0];
  const asViewed = await (await call('/api/me', { headers: { Cookie: cookie } })).json();
  assert.equal(asViewed.id, other.id, 'com o cookie, o admin vê os dados do outro');
  assert.equal(asViewed.viewingAs, true);
  assert.equal(asViewed.realUser.id, OWNER_ID, 'a sessão sabe quem está de fato do outro lado');
  assert.equal((await call('/api/logs', { headers: { Cookie: cookie } })).status, 403, 'vendo como outro, rota só do dono fica fechada — é o que ele veria');
  assert.equal((await call('/api/admin/users', { headers: { Cookie: cookie } })).status, 200, 'vendo como outro, o painel admin continua aberto para voltar');
  const stolen = await (await call('/api/me', { headers: { ...otherViaTailnet, Cookie: `hub_view_as=${OWNER_ID}` } })).json();
  assert.equal(stolen.id, other.id, 'cookie de ver como vindo de quem não é admin é ignorado');

  // ─── F2: módulo em manutenção ─────────────────────────────────────────────
  assert.equal((await call('/api/admin/maintenance/goals', json({ message: 'x' }, { method: 'PUT', headers: otherViaTailnet }))).status, 403, 'só o admin põe módulo em manutenção');
  assert.equal((await call('/api/admin/maintenance/goals', json({ message: 'Consertando as metas, volta hoje.' }, { method: 'PUT' }))).status, 200);
  const meDuring = await (await call('/api/me', { headers: otherViaTailnet })).json();
  assert.deepEqual(meDuring.maintenance.map((m) => m.moduleId), ['goals'], 'todo usuário fica sabendo da manutenção');
  const putGoals = (headers) => call('/api/store/goals.list', json({ value: ['nova'] }, { method: 'PUT', headers }));
  assert.equal((await putGoals(otherViaTailnet)).status, 423, 'em manutenção, quem não é admin não grava nas chaves do módulo');
  assert.equal((await call('/api/store/goals.list', { method: 'DELETE', headers: otherViaTailnet })).status, 423, 'nem apaga');
  assert.equal((await call('/api/store/finance.x', json({ value: 1 }, { method: 'PUT', headers: otherViaTailnet }))).status, 200, 'os outros módulos seguem normais');
  assert.equal((await putGoals({})).status, 200, 'o admin continua gravando — é ele quem conserta');
  await call('/api/admin/maintenance/goals', { method: 'DELETE' });
  assert.equal((await putGoals(otherViaTailnet)).status, 200, 'fim da manutenção devolve a escrita');
  await call('/api/store/finance.x', { method: 'DELETE', headers: otherViaTailnet });

  const asOtherJson = (body, method) => json(body, { method, headers: otherViaTailnet });

  // ─── F3: SIGAA de cada usuário ────────────────────────────────────────────
  const ownerSigaaBefore = await (await call('/api/connections/sigaa')).json();
  assert.deepEqual(await (await call('/api/connections/sigaa', { headers: otherViaTailnet })).json(), { configured: false }, 'sem SIGAA configurado');
  assert.equal((await call('/api/connections/sigaa/credentials', asOtherJson({ login: 'aluno.teste' }, 'PUT'))).status, 400, 'sem senha é recusado');
  assert.equal((await call('/api/connections/sigaa/credentials', asOtherJson({ login: 'aluno.teste', password: 'senha-do-sigaa' }, 'PUT'))).status, 200);
  const otherSigaa = await (await call('/api/connections/sigaa', { headers: otherViaTailnet })).json();
  assert.deepEqual(otherSigaa, { configured: true }, 'o status nunca traz o login nem a senha');
  const rawSigaa = new DatabaseSync(dbPath, { readOnly: true });
  const storedPassword = rawSigaa.prepare("SELECT value FROM secrets WHERE user_id = ? AND name = 'sigaa.password'").get(other.id)?.value ?? '';
  rawSigaa.close();
  assert.ok(storedPassword.startsWith('enc:v1:') && !storedPassword.includes('senha-do-sigaa'), 'a senha do SIGAA fica cifrada');
  assert.deepEqual(await (await call('/api/connections/sigaa')).json(), ownerSigaaBefore, 'o SIGAA do usuário 2 não muda o do dono');
  await call('/api/connections/sigaa', { method: 'DELETE', headers: otherViaTailnet });
  assert.deepEqual(await (await call('/api/connections/sigaa', { headers: otherViaTailnet })).json(), { configured: false }, 'remover apaga as credenciais');

  // ─── F3: o painel admin sabe o que cada um conectou, sem ver a credencial ──
  await call('/api/connections/sigaa/credentials', asOtherJson({ login: 'aluno.teste', password: 'senha-do-sigaa' }, 'PUT'));
  const adminView = (await (await call('/api/admin/users')).json()).find((u) => u.id === other.id);
  assert.equal(adminView.integrations.sigaa, true, 'o painel sabe que a pessoa conectou o SIGAA');
  assert.ok(!JSON.stringify(adminView).includes('senha-do-sigaa'), 'e nunca vê a senha');
  await call('/api/connections/sigaa', { method: 'DELETE', headers: otherViaTailnet });
  assert.equal((await call('/api/admin/users', { headers: otherViaTailnet })).status, 403, 'e só o admin vê isso');

  // ─── Push: aparelhos (APK/FCM) por usuário ───────────────────────────────
  const fakeToken = 'fcm-token-do-celular-do-usuario-2-'.padEnd(60, 'x');
  assert.equal((await call('/api/push/devices', asOtherJson({ token: 'curto' }, 'POST'))).status, 400, 'token absurdo é recusado');
  const registered = await (await call('/api/push/devices', asOtherJson({ token: fakeToken, device: 'Moto G' }, 'POST'))).json();
  assert.equal(registered.total, 1, 'o celular do usuário 2 fica registrado');
  await call('/api/push/devices', asOtherJson({ token: fakeToken, device: 'Moto G' }, 'POST'));
  assert.equal((await (await call('/api/store/push.devices', { headers: otherViaTailnet })).json()).value.length, 1, 'registrar de novo o mesmo token não duplica');
  assert.equal((await call('/api/store/push.devices')).status, 404, 'o aparelho do usuário 2 não aparece para o dono');
  const sentOwner = await (await call('/api/push/send', json({ title: 'teste' }, { method: 'POST' }))).json();
  assert.equal(sentOwner.fcm.sent, 0, 'notificação do dono nunca vai para o celular de outro usuário');
  assert.equal(sentOwner.ok, true, 'sem Firebase configurado o envio é pulado, sem erro');
  // Aviso de falha que se repete a cada rodada sai uma vez por dia.
  const failurePush = () => call('/api/push/send', json({ title: 'SIGAA pediu captcha', dedupeKey: 'sigaa:captcha' }, { method: 'POST' })).then((r) => r.json());
  assert.notEqual((await failurePush()).deduped, true, 'o primeiro aviso com dedupeKey sai');
  assert.equal((await failurePush()).deduped, true, 'o mesmo aviso de novo no mesmo dia é segurado');
  await call('/api/push/devices/unregister', asOtherJson({ token: fakeToken }, 'POST'));
  assert.deepEqual((await (await call('/api/store/push.devices', { headers: otherViaTailnet })).json()).value, [], 'desregistrar remove o aparelho');

  // ─── APK: publicação e atualização ───────────────────────────────────────
  const fakeApk = Buffer.concat([Buffer.from('PK'), Buffer.alloc(4096, 7)]);
  const publish = (code, headers = {}) => call(`/api/admin/app/android?versionCode=${code}&versionName=1.${code}`, {
    method: 'POST', headers: { 'Content-Type': 'application/vnd.android.package-archive', ...headers }, body: fakeApk,
  });
  assert.equal((await call('/api/app/android/latest', { headers: otherViaTailnet })).status, 404, 'sem versão publicada ainda');
  assert.equal((await publish(10, otherViaTailnet)).status, 403, 'só o admin publica APK');
  const published = await publish(10);
  assert.equal(published.status, 201, 'admin publica o APK');
  const release = await published.json();
  assert.equal(release.sha256, createHash('sha256').update(fakeApk).digest('hex'), 'o SHA-256 anunciado é o do arquivo');
  assert.equal((await publish(10)).status, 409, 'versão igual ou menor é recusada');
  assert.equal((await call('/api/admin/app/android?versionCode=11&versionName=x', { method: 'POST', headers: { 'Content-Type': 'application/vnd.android.package-archive' }, body: Buffer.alloc(4096, 1) })).status, 400, 'arquivo que não é APK é recusado');
  assert.equal((await (await call('/api/app/android/latest', { headers: otherViaTailnet })).json()).versionCode, 10, 'todo usuário vê a versão nova');
  const downloaded = Buffer.from(await (await call('/api/app/android/apk', { headers: otherViaTailnet })).arrayBuffer());
  assert.ok(downloaded.equals(fakeApk), 'o download entrega exatamente o APK publicado');

  // ─── F3: arquivos pendentes por usuário ───────────────────────────────────
  writePending('sigaa', '{"items":[]}', other.id);
  assert.equal((await call('/api/pending/sigaa', { headers: otherViaTailnet })).status, 200, 'cada usuário lê o próprio pendente');
  assert.equal((await call('/api/pending/sigaa')).status, 404, 'o pendente do usuário 2 não chega ao dono');

  // ─── F4: porta pública — só o certificado do aparelho identifica ──────────
  const TEST_DEVICE_PEM = `-----BEGIN CERTIFICATE-----
MIIDGzCCAgOgAwIBAgIUTxFz9ZDLh2FqQyf2ECCYxJeQY4QwDQYJKoZIhvcNAQEL
BQAwHTEbMBkGA1UEAwwSb2xpbXBvLXRlc3QtZGV2aWNlMB4XDTI2MTAxMjA0NTYw
MVoXDTM2MTAwOTA0NTYwMVowHTEbMBkGA1UEAwwSb2xpbXBvLXRlc3QtZGV2aWNl
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmwEsSgW7XysZYemAFzyP
l1dtX1xTFh3La+iUbQ6jwtpGB/uOYMPsziR+4lAnMVw0VHc5y08tevObN3N5AitE
+zBYunbObk7MWSn8a1ZjIPcA0xSK5VTiuRqdXOl/MhnNB9YdtnhvA2pwvonbjU32
esmHlBCWe2vii5MxaE5apQTn5EeTtoURSusntObiE6RYZGDfJ4+nl9gnGWZBhpAZ
H3jcgnKCsE7xh5P7IwzB7gnmm/iJjnNfAY9ys3shwBu0M2KKXqamTaLm9p2GUXzB
/W80FWI1A2jIytWLwKv78Fz14MRCZLJLXFxCsWAmjLIOCu9GZ69Q12yr0QcqTjAR
6QIDAQABo1MwUTAdBgNVHQ4EFgQUZuQL/Gvh3q835+ZYo+xRbQBQqxAwHwYDVR0j
BBgwFoAUZuQL/Gvh3q835+ZYo+xRbQBQqxAwDwYDVR0TAQH/BAUwAwEB/zANBgkq
hkiG9w0BAQsFAAOCAQEAI0B7ViPvT/xWgcgQFu96mfTJuiLxZZAUY+BfaM1LzzXu
HEe2qWSO1cIDgKw6V+m6jpdzxcPImSbP1dBHQOWeWg1ZHugQNJ/xC6HlaP676y7c
quUAS1MPmBcTmdoInmKX/1NYgA9u8MWdrjKaoeYLmY8L2hla/uKukRbxx/lEFTsg
L0ZVjBAHYnYgQ0ZW0lc6AUsbjjUp9LPotyYO9huxjeadaftTYprwLEKIkcA4NZQB
E7Ao9kkAnkJBgQPBX15N0CS3pe+8MeIH+fOpmZ8e2SsIMsVA4T8TqUDcHkGfy4oI
SlZl+9Q41MNMZS5FzZW5yzbFzoxzxP8+g4ha7HE47w==
-----END CERTIFICATE-----`;
  // Tudo ali chega de 127.0.0.1 (o cloudflared), como os scripts locais: se a
  // porta pública herdasse a confiança da privada, a internet viraria o dono.
  const { publicPortHandler } = await import('../server/index.js');
  const publicServer = createServer(publicPortHandler).listen(0, '127.0.0.1');
  await new Promise((resolve) => publicServer.once('listening', resolve));
  const pub = (path, headers = {}) => fetch(`http://127.0.0.1:${publicServer.address().port}${path}`, { headers });
  const ownerFp = 'aa'.repeat(32);
  const otherFp = `${'AB:'.repeat(31)}AB`;
  const ownerCert = { 'cf-cert-verified': 'true', 'cf-cert-sha256': ownerFp };
  const otherCert = { 'cf-cert-verified': 'true', 'cf-cert-sha256': otherFp.replace(/:/g, '').toLowerCase() };
  const registerCert = (body, headers = {}) => call('/api/admin/certs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await pub('/api/store')).status, 403, 'sem certificado a porta pública recusa, mesmo vindo de localhost');
    assert.equal((await pub('/api/store', ownerCert)).status, 403, 'certificado válido mas sem cadastro é recusado');

    assert.equal((await registerCert({ userId: OWNER_ID, label: 'x', fingerprint: 'abc' })).status, 400, 'impressão digital que não é SHA-256 é recusada');
    assert.equal((await registerCert({ userId: other.id, label: 'Celular do 2', fingerprint: otherFp }, otherViaTailnet)).status, 403, 'só o admin cadastra certificado');
    assert.equal((await registerCert({ userId: OWNER_ID, label: 'Celular do Bernardo', fingerprint: ownerFp })).status, 201, 'admin cadastra o certificado do próprio aparelho');
    assert.equal((await registerCert({ userId: other.id, label: 'Celular do 2', fingerprint: otherFp })).status, 201, 'admin cadastra o aparelho de outra pessoa (com dois-pontos e maiúsculas)');
    assert.equal((await registerCert({ userId: other.id, label: 'de novo', fingerprint: otherFp })).status, 409, 'o mesmo certificado não é cadastrado duas vezes');
    // O painel cola o certificado inteiro (o que a Cloudflare mostra): o servidor
    // tira dele a impressão digital e a validade. Autoassinado, só para o teste.
    const pemCert = await registerCert({ userId: other.id, label: 'Notebook do 2', certificate: TEST_DEVICE_PEM });
    assert.equal(pemCert.status, 201, 'cadastrar colando o certificado funciona');
    const pemBody = await pemCert.json();
    assert.equal(pemBody.fingerprint, '4578cfab91fcb8a7d27cbd2c8f272acaf6765a8f3e536efb17436e798c7accb4', 'a impressão digital sai do próprio certificado');
    assert.equal(pemBody.notAfter, '2036-10-09T04:56:01.000Z', 'a validade sai do próprio certificado');
    assert.equal((await registerCert({ userId: other.id, label: 'x', certificate: 'não é certificado' })).status, 400, 'texto que não é certificado é recusado');
    assert.equal((await (await call('/api/admin/certs')).json()).length, 3, 'o painel lista os certificados');

    // Um clique no painel: a Cloudflare assina, o Olimpo cadastra e devolve o .p12.
    assert.equal((await (await call('/api/admin/certs/generator')).json()).available, true, 'com a API configurada o painel gera sozinho');
    const generated = await call('/api/admin/certs/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: other.id, label: 'Celular da Ana' }),
    });
    assert.equal(generated.status, 201, 'gerar certificado pelo painel funciona');
    const gen = await generated.json();
    assert.match(gen.password, /^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/, 'a senha do .p12 volta junto, legível para ditar');
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(Buffer.from(gen.p12, 'base64').toString('binary')), gen.password);
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    assert.equal(keyBags.length, 1, 'o .p12 abre com a senha e traz a chave');
    const p12Cert = certBags[0].cert;
    assert.equal(p12Cert.issuer.getField('CN').value, 'Mock Cloudflare CA', 'o certificado no .p12 é o que a Cloudflare assinou');
    assert.equal(p12Cert.subject.getField('CN').value, 'celular-da-ana', 'o nome do aparelho vira o CN, sem espaços nem acentos');
    const p12Fingerprint = forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(p12Cert)).getBytes()).digest().toHex();
    assert.equal(gen.fingerprint, p12Fingerprint, 'o Olimpo cadastra exatamente o certificado do .p12');
    assert.equal(gen.notAfter.slice(0, 10), '2027-10-12', 'validade de um ano');
    assert.equal((await (await call('/api/me', {})).json()).id, OWNER_ID, 'gerar não troca a sessão de ninguém');
    const anaCert = { 'cf-cert-verified': 'true', 'cf-cert-sha256': gen.fingerprint };
    assert.equal((await (await pub('/api/me', anaCert)).json()).id, other.id, 'o certificado gerado já entra pela porta pública como a pessoa');
    assert.equal((await registerCert({ userId: other.id, label: 'x', fingerprint: gen.fingerprint })).status, 409, 'o gerado já está cadastrado');
    assert.equal((await call('/api/admin/certs/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...otherViaTailnet }, body: JSON.stringify({ userId: other.id, label: 'y' }),
    })).status, 403, 'só o admin gera certificado');
    assert.equal((await pub('/api/admin/certs/generate', ownerCert)).status, 403, 'gerar certificado só pelo Tailscale');

    const revokedGen = await (await call(`/api/admin/certs/${gen.fingerprint}`, { method: 'DELETE' })).json();
    assert.ok(revokedGen.revokedAt, 'revogar o gerado funciona');
    assert.equal(revokedGen.cloudflareError, null, 'sem erro na Cloudflare');
    assert.deepEqual(cloudflareRevoked, ['cf-cert-1'], 'a revogação também vai para a Cloudflare');
    assert.equal((await pub('/api/me', anaCert)).status, 403, 'revogado não entra mais');

    assert.ok((await (await pub('/api/store', ownerCert)).json())['projects.list'], 'o certificado do dono abre os dados do dono');
    assert.equal((await (await pub('/api/store', otherCert)).json())['projects.list'], undefined, 'o certificado do usuário 2 não traz dados do dono');
    assert.equal((await (await pub('/api/me', otherCert)).json()).id, other.id, 'a identidade sai do certificado');

    assert.equal((await pub('/api/store', { ...otherCert, 'X-Hub-User': String(OWNER_ID) })).status, 403, 'X-Hub-User não vale na porta pública');
    assert.equal((await (await pub('/api/me', { ...ownerCert, Cookie: `hub_view_as=${other.id}` })).json()).id, OWNER_ID, '"ver como" por cookie não vale na porta pública');
    assert.equal((await pub('/api/store', { ...ownerCert, 'Tailscale-User-Login': 'teste@example.com' })).status, 200, 'o login do tailnet é ignorado na porta pública');
    assert.equal((await pub('/api/store', { ...ownerCert, 'cf-cert-verified': 'false' })).status, 403, 'certificado não verificado pela Cloudflare é recusado');
    assert.equal((await pub('/api/store', { ...ownerCert, 'cf-cert-revoked': 'true' })).status, 403, 'certificado revogado na Cloudflare é recusado');
    assert.equal((await pub('/api/store', { 'cf-cert-verified': 'true', 'cf-cert-sha256': `${otherCert['cf-cert-sha256']}, ${ownerFp}` })).status, 403, 'impressão digital repetida (cabeçalho forjado + o da Cloudflare) é recusada');

    assert.equal((await pub('/api/admin/users', ownerCert)).status, 403, 'painel admin só pelo Tailscale, mesmo para o admin');
    assert.equal((await pub('/api/admin/certs', ownerCert)).status, 403, 'cadastro de certificado só pelo Tailscale');
    assert.equal((await pub('/api/jarvis/config', ownerCert)).status, 403, 'nível de acesso à máquina só pelo Tailscale');
    assert.equal((await pub('/api/jarvis/commands', ownerCert)).status, 403, 'aprovar comando na máquina só pelo Tailscale');
    assert.equal((await pub('/api/agent/status', ownerCert)).status, 403, 'as mãos só pelo Tailscale');
    assert.equal((await pub('/api/logs', ownerCert)).status, 200, 'o resto das rotas do dono funciona pela porta pública');

    assert.equal((await call(`/api/admin/certs/${ownerFp}`, { method: 'DELETE' })).status, 200, 'admin revoga o certificado');
    assert.equal((await pub('/api/store', ownerCert)).status, 403, 'certificado revogado no Olimpo deixa de entrar');
    assert.equal((await call(`/api/admin/certs/${ownerFp}`, { method: 'DELETE' })).status, 404, 'revogar de novo não acha nada');
    assert.equal((await call('/api/store')).status, 200, 'a porta privada segue igual');
  } finally {
    publicServer.close();
  }
} finally {
  server.close();
  cloudflareMock.close();
}

// Melhor esforço: no Windows o hub.db segue aberto por este processo e a pasta
// temporária não sai — sobra no %TEMP%, não é falha do teste.
try { rmSync(dir, { recursive: true, force: true }); } catch { /* arquivo do banco ainda aberto */ }

console.log('Multiuser check passed.');
process.exit(0);
