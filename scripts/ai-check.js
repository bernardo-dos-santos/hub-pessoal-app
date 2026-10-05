/**
 * ai-check.js — sanity check da camada de IA.
 *
 * Cobre as três regras que decidem custo e disponibilidade e que quebram em
 * silêncio (nada estoura, a IA só passa a gastar errado ou a parar sozinha):
 *
 *  1. A ordem da cadeia começa pela Secundária. Inverter isso faz toda geração
 *     automática consumir a chave paga antes da cota gratuita, sem nenhum sinal.
 *  2. A classificação do erro do provedor. "Sem crédito" precisa virar 'quota'
 *     (cai para o próximo slot) e não 'auth' — a Anthropic devolve saldo zerado
 *     como 400, o mesmo status de chave inválida.
 *  3. A cifragem dos segredos. Um round-trip quebrado só apareceria na hora de
 *     usar a chave, muito depois de salvá-la.
 *
 * Rodar: node --env-file=.env scripts/ai-check.js  (ou npm test)
 */

import assert from 'node:assert';
import { randomBytes } from 'node:crypto';

// A chave de cifragem é do ambiente; sem ela o check não teria o que exercitar.
// Gerar uma aqui mantém o teste independente do .env da máquina.
process.env.CREDENTIALS_ENCRYPTION_KEY ??= randomBytes(32).toString('base64');

const { CHAIN_ORDER } = await import('../server/ai/chain.js');
const { classifyProviderError } = await import('../server/ai/aiError.js');
const { encryptSecret, decryptSecret, isEncrypted } = await import('../server/crypto.js');
const { adapters, PROVIDER_META } = await import('../server/ai/adapters/index.js');
const { SLOTS } = await import('../server/ai/aiSettings.js');

// ── 1. Ordem da cadeia ───────────────────────────────────────────────────────

assert.deepStrictEqual(
  CHAIN_ORDER,
  ['secundaria', 'principal', 'fallback'],
  'A cadeia precisa começar pela Secundária: é ela que gasta a cota gratuita antes da paga.',
);
assert.deepStrictEqual(
  [...CHAIN_ORDER].sort(),
  [...SLOTS].sort(),
  'Todo slot declarado tem que estar na ordem de tentativa — um slot fora dela nunca seria usado.',
);

// ── 2. Classificação do erro do provedor ─────────────────────────────────────

const quota = [
  // Mensagem literal observada do Gemini em 19/08, com a chave sem saldo.
  [429, 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.'],
  [400, 'Your prepayment credits are depleted.'],
  [400, 'Your credit balance is too low to access the Anthropic API'],
  [400, 'billing_error: payment required'],
  [429, 'Rate limit exceeded'],
  [429, 'Too many requests'],
  [429, 'Quota exceeded for quota metric'],
  [403, 'RESOURCE_EXHAUSTED'],
];
for (const [status, message] of quota) {
  assert.strictEqual(
    classifyProviderError(status, message), 'quota',
    `"${message}" (${status}) precisa cair para o próximo slot, não ser tratado como chave inválida.`,
  );
}

const auth = [
  [400, 'API key not valid. Please pass a valid API key.'],
  [401, 'invalid x-api-key'],
  [403, 'Permission denied'],
];
for (const [status, message] of auth) {
  assert.strictEqual(classifyProviderError(status, message), 'auth', `"${message}" (${status}) deveria ser 'auth'.`);
}

assert.strictEqual(classifyProviderError(500, 'internal error'), 'other');
assert.strictEqual(classifyProviderError(503, ''), 'other');

// ── 3. Cifragem dos segredos ─────────────────────────────────────────────────

const secret = 'sk-ant-teste-' + randomBytes(8).toString('hex');
const sealed = encryptSecret(secret);
assert.ok(isEncrypted(sealed), 'O valor guardado precisa ser reconhecível como cifrado.');
assert.ok(!sealed.includes(secret), 'A chave não pode aparecer em claro dentro do valor guardado.');
assert.strictEqual(decryptSecret(sealed), secret, 'Round-trip de cifragem falhou.');

// Segredo gravado antes desta camada existir volta como está — é o caminho de
// migração, e quebrá-lo transformaria chave antiga em lixo indecifrável.
assert.strictEqual(decryptSecret('AIzaSy-chave-antiga-em-claro'), 'AIzaSy-chave-antiga-em-claro');
assert.strictEqual(decryptSecret(null), null);

// GCM autentica: ciphertext adulterado tem que estourar, não decifrar em lixo.
const parts = sealed.split(':');
parts[4] = Buffer.from('outra coisa qualquer').toString('base64');
assert.throws(() => decryptSecret(parts.join(':')), 'Ciphertext adulterado deveria falhar na verificação da tag.');

// ── 4. Contrato dos adaptadores ──────────────────────────────────────────────

for (const [id, adapter] of Object.entries(adapters)) {
  assert.strictEqual(adapter.id, id, `O id do adaptador ${id} não bate com a chave do registro.`);
  assert.strictEqual(typeof adapter.complete, 'function', `${id} precisa de complete().`);
  assert.ok(adapter.defaultModel, `${id} precisa de um modelo padrão.`);
  if (adapter.needsBaseUrl) assert.ok(adapter.defaultBaseUrl, `${id} exige baseUrl e precisa de um padrão.`);
}
assert.strictEqual(PROVIDER_META.length, Object.keys(adapters).length);
// Os metadados são o que a tela usa para montar o formulário; chave vazando
// para eles seria chave chegando ao browser.
for (const meta of PROVIDER_META) {
  assert.ok(!('apiKey' in meta), 'PROVIDER_META não pode carregar credencial.');
}

console.log('AI check passed.');
