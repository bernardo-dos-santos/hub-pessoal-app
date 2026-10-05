/**
 * crypto.js — cifragem simétrica dos segredos que o Hub guarda por usuário.
 *
 * Usado hoje pelas chaves de API de IA (server/ai/aiSettings.js) e projetado
 * para receber também as credenciais do SIGAA por usuário, que são o mesmo tipo
 * de segredo: valor que o servidor precisa em claro na hora de usar, mas que não
 * pode ficar legível no banco.
 *
 * AES-256-GCM: além de cifrar, autentica — um valor adulterado no hub.db falha
 * na verificação da tag em vez de decifrar em lixo silencioso.
 *
 * A chave vive em CREDENTIALS_ENCRYPTION_KEY (32 bytes em base64). Gerar com:
 *   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGO   = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LEN = 12; // 96 bits — tamanho recomendado para GCM

let cachedKey;

function loadKey() {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    cachedKey = null;
    return cachedKey;
  }
  const buf = Buffer.from(raw.trim(), 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY inválida: esperados 32 bytes em base64, recebidos ${buf.length}. `
      + 'Gere uma com: node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  cachedKey = buf;
  return cachedKey;
}

/** Há chave de cifragem configurada neste servidor? */
export function encryptionAvailable() {
  return loadKey() !== null;
}

/** O valor guardado está cifrado (vs. escrito em claro por uma versão anterior)? */
export function isEncrypted(stored) {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}

/**
 * Cifra um segredo. Lança se não houver CREDENTIALS_ENCRYPTION_KEY — gravar em
 * claro por omissão de configuração é justamente o que esta camada existe para
 * impedir, então a falha precisa ser visível na hora de salvar.
 * @param {string} plain
 * @returns {string} `enc:v1:<iv>:<tag>:<ciphertext>`, tudo em base64
 */
export function encryptSecret(plain) {
  const key = loadKey();
  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY não configurada no servidor — não é possível guardar segredos com segurança.',
    );
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decifra. Valor sem o prefixo volta como está: é o caminho de migração dos
 * segredos gravados em claro antes desta camada existir.
 * @param {string | null} stored
 * @returns {string | null}
 */
export function decryptSecret(stored) {
  if (stored === null || stored === undefined || stored === '') return null;
  if (!isEncrypted(stored)) return String(stored);

  const key = loadKey();
  if (!key) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY não configurada — há segredos cifrados no banco que não podem ser lidos.');
  }
  const [, , ivB64, tagB64, dataB64] = stored.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Segredo cifrado com formato inválido.');

  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
