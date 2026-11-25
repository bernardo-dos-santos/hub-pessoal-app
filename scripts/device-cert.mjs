/**
 * device-cert.mjs — prepares one device's certificate for the public address (F4).
 *
 *   npm run cert:device -- new "Celular da Ana"
 *       Generates the private key and the signing request (CSR) in
 *       ~/.olimpo-certs/<slug>/ and prints the CSR to paste into Cloudflare
 *       (SSL/TLS → Client Certificates → Create → "Use my private key and CSR").
 *
 *   npm run cert:device -- finish "Celular da Ana" certificado.pem [--legacy]
 *       Takes the certificate Cloudflare signed, checks it matches the key, and
 *       builds the .p12 the device installs. openssl asks for the .p12's password
 *       right here in the terminal — whoever runs this types it; send it to the
 *       person through a different channel than the file. --legacy: older
 *       Android versions reject the modern .p12 format as "wrong password".
 *
 * The key never leaves this machine except inside the password-protected .p12,
 * and never goes to Cloudflare. ~/.olimpo-certs is outside the repo; don't move
 * it in. Registering the device in the Olimpo is the Usuários panel's job
 * (paste the same certificate there).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const [command, name, certArg, ...flags] = process.argv.slice(2);

function fail(message) {
  console.error(`[cert] ${message}`);
  process.exit(1);
}

/** openssl from PATH, or the one Git for Windows ships (Git Bash has it, plain PowerShell often doesn't). */
function findOpenssl() {
  const candidates = ['openssl', 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe'];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // not this one
    }
  }
  return fail('openssl não encontrado — instale o Git for Windows ou rode pelo Git Bash.');
}

function slugOf(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

if (!['new', 'finish'].includes(command) || !name) {
  fail('uso: npm run cert:device -- new "Nome do aparelho"  |  finish "Nome do aparelho" certificado.pem [--legacy]');
}

const slug = slugOf(name);
if (!slug) fail('o nome precisa ter letras ou números.');
const dir = join(homedir(), '.olimpo-certs', slug);
const keyPath = join(dir, `${slug}.key`);
const csrPath = join(dir, `${slug}.csr`);
const certPath = join(dir, `${slug}.crt`);
const p12Path = join(dir, `${slug}.p12`);
const openssl = findOpenssl();

if (command === 'new') {
  if (existsSync(keyPath)) fail(`já existe uma chave para "${name}" em ${dir} — use outro nome ou siga com "finish".`);
  mkdirSync(dir, { recursive: true });
  execFileSync(openssl, ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', csrPath, '-subj', `/CN=${slug}/O=Olimpo`], { stdio: 'ignore' });
  console.log(`[cert] Chave e pedido gerados em ${dir}\n`);
  console.log(readFileSync(csrPath, 'utf-8'));
  console.log('Próximo passo: na Cloudflare, SSL/TLS → Client Certificates → Create → "Use my private key and CSR",');
  console.log('cole o pedido acima, validade de 1 ano. Depois, com o certificado que ela mostrar salvo num arquivo:');
  console.log(`  npm run cert:device -- finish "${name}" certificado.pem`);
} else {
  if (!certArg) fail('falta o arquivo do certificado que a Cloudflare assinou.');
  if (!existsSync(keyPath)) fail(`não há chave para "${name}" — comece com "new".`);
  const source = resolve(certArg);
  if (!existsSync(source)) fail(`arquivo não encontrado: ${source}`);

  let cert;
  try {
    cert = new X509Certificate(readFileSync(source));
  } catch {
    fail('isso não é um certificado — salve o bloco inteiro, de BEGIN CERTIFICATE a END CERTIFICATE.');
  }
  const certModulus = execFileSync(openssl, ['x509', '-in', source, '-noout', '-modulus']).toString().trim();
  const keyModulus = execFileSync(openssl, ['rsa', '-in', keyPath, '-noout', '-modulus']).toString().trim();
  if (certModulus !== keyModulus) fail(`esse certificado não é o do pedido de "${name}" — confira se colou o CSR certo na Cloudflare.`);
  copyFileSync(source, certPath);

  console.log(`[cert] Certificado confere com a chave. Vale até ${new Date(cert.validTo).toLocaleDateString('pt-BR')}.`);
  console.log('[cert] Agora o openssl pede a senha do arquivo .p12 (duas vezes). Escolha uma e guarde para mandar à pessoa.\n');
  const result = spawnSync(openssl, [
    'pkcs12', '-export', '-inkey', keyPath, '-in', certPath, '-name', `Olimpo - ${name}`, '-out', p12Path,
    ...(flags.includes('--legacy') ? ['-legacy'] : []),
  ], { stdio: 'inherit' });
  if (result.status !== 0) fail('o openssl não gerou o .p12.');
  console.log(`\n[cert] Pronto: ${p12Path}`);
  console.log('Cadastre o mesmo certificado no Olimpo (Configurações → Usuários → Aparelhos com acesso pela internet),');
  console.log('mande o .p12 para a pessoa e a senha por outro canal.');
}
