/**
 * deviceCerts.js — issues and revokes device certificates for the public
 * address (F4) in one step, through Cloudflare's API.
 *
 * The admin clicks "Gerar certificado" in the Usuários panel and gets back a
 * .p12 and its password; nothing else to copy around. Here: a fresh RSA key and
 * CSR, Cloudflare signs the CSR (POST /zones/:zone/client_certificates), the
 * certificate is registered in `client_certs`, and key + certificate go into a
 * password-protected .p12. The key and the password exist only in the response
 * — never written to disk or the database; lose the .p12 and you generate
 * another one.
 *
 * Needs CLOUDFLARE_API_TOKEN (a token scoped to "SSL and Certificates: Edit" on
 * the Olimpo's zone, created by the admin) and CLOUDFLARE_ZONE_ID in `.env`.
 * Without them the panel falls back to pasting a certificate signed by hand
 * (`npm run cert:device`). CLOUDFLARE_API_URL exists for the tests' mock.
 */

import forge from 'node-forge';
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const API = process.env.CLOUDFLARE_API_URL ?? 'https://api.cloudflare.com/client/v4';

/** One year, the same as the hand-made ones; the health screen warns 30 days before. */
const VALIDITY_DAYS = 365;

export function generatorAvailable() {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
}

async function cloudflare(method, path, body) {
  const res = await fetch(`${API}/zones/${process.env.CLOUDFLARE_ZONE_ID}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const detail = json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`A Cloudflare recusou: ${detail}`);
  }
  return json.result;
}

/** CN without spaces or accents: "Celular da Ana" → "celular-da-ana". */
function commonName(label) {
  return label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aparelho';
}

/**
 * Easy to dictate and type on a phone (no 0/O, 1/l), 16 characters ≈ 80 bits —
 * plenty for a file that travels separately from it.
 */
function newPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
}

/**
 * @returns {{ certificate: string, fingerprint: string, notAfter: string, cloudflareId: string, p12: Buffer, password: string }}
 */
export async function issueDeviceCertificate(label) {
  // Node's native generator (forge's pure-JS one takes seconds for 2048 bits);
  // forge only for what Node has no API for: the CSR and the .p12.
  const { privateKey: privatePem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const privateKey = forge.pki.privateKeyFromPem(privatePem);
  const keys = { privateKey, publicKey: forge.pki.setRsaPublicKey(privateKey.n, privateKey.e) };
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([{ name: 'commonName', value: commonName(label) }, { name: 'organizationName', value: 'Olimpo' }]);
  csr.sign(keys.privateKey, forge.md.sha256.create());

  const signed = await cloudflare('POST', '/client_certificates', {
    csr: forge.pki.certificationRequestToPem(csr),
    validity_days: VALIDITY_DAYS,
  });

  const cert = forge.pki.certificateFromPem(signed.certificate);
  const password = newPassword();
  // 3DES, not AES: Android's certificate installer still rejects some AES
  // .p12 files as "wrong password" (the same reason `npm run cert:device`
  // offers --legacy), and the password is what protects the file in transit.
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: '3des',
    friendlyName: `Olimpo - ${label}`,
  });
  const p12 = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');

  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const fingerprint = forge.md.sha256.create().update(der).digest().toHex();

  return {
    certificate: signed.certificate,
    fingerprint,
    notAfter: cert.validity.notAfter.toISOString(),
    cloudflareId: signed.id,
    p12,
    password,
  };
}

/** Revokes at Cloudflare too, so it blocks the device before it reaches the server. */
export async function revokeAtCloudflare(cloudflareId) {
  await cloudflare('DELETE', `/client_certificates/${cloudflareId}`);
}
