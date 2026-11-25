/**
 * usersApi.js — the signed-in user's own profile (/api/me) and the admin panel
 * (/api/admin). Mounted after the identity middleware in server/index.js, so
 * `req.userId` (whose data) and `req.realUserId` (who is actually there) are set.
 *
 * Admin permission is decided by the REAL user: while the admin is "viewing
 * as" someone, req.userId is that person, and /api/admin must keep working so
 * the admin can switch back.
 */

import { X509Certificate } from 'node:crypto';
import { z } from 'zod';
import { clientCerts, kvStore, maintenance, normalizeFingerprint, users } from './db.js';
import { OWNER_ID, runAsUser } from './userContext.js';
import { VIEW_AS_COOKIE } from './identity.js';
import { readSigaaConfig } from './connections/sigaa.js';
import { generatorAvailable, issueDeviceCertificate, revokeAtCloudflare } from './deviceCerts.js';

const MODULE_ID = /^[a-z]+$/;
const moduleIds = z.array(z.string().regex(MODULE_ID)).max(30);

/** What the browser may see about a user — never anything from `secrets`. */
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tailscaleLogin: user.tailscale_login,
    isAdmin: Boolean(user.is_admin),
    modules: user.modules ? JSON.parse(user.modules) : null,
    onboardedAt: user.onboarded_at,
    disabledAt: user.disabled_at,
    lastSeenAt: user.last_seen_at,
    createdAt: user.created_at,
  };
}

function parseJson(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function uniqueViolation(err) {
  return err instanceof Error && /UNIQUE constraint failed: users\.(\w+)/.exec(err.message)?.[1];
}

function sendWriteError(res, err) {
  const column = uniqueViolation(err);
  if (column) return res.status(409).json({ error: `Já existe um usuário com esse ${column === 'email' ? 'e-mail' : 'login do Tailscale'}.` });
  throw err;
}

/**
 * A module in maintenance is read-only for everyone but the admin: hiding the
 * screen isn't enough when the reason is a bug that corrupts data — a tab left
 * open would keep writing. Module ids are the key prefixes (`finance.` …).
 */
export function isMaintenanceLocked(key, realUserId) {
  if (users.get(realUserId)?.is_admin) return false;
  return maintenance.list().some((m) => key.startsWith(`${m.moduleId}.`));
}

// Throttled: one write per user every few minutes is enough for "last seen".
const SEEN_EVERY_MS = 5 * 60_000;
const lastSeenWrite = new Map();

/** Records activity of the real user (not of whoever the admin is viewing as). */
export function touchLastSeen(realUserId, userId) {
  if (realUserId !== userId) return;
  const now = Date.now();
  if (now - (lastSeenWrite.get(userId) ?? 0) < SEEN_EVERY_MS) return;
  lastSeenWrite.set(userId, now);
  users.markSeen(userId, new Date(now).toISOString());
}

export function registerUserRoutes(app) {
  app.get('/api/me', (req, res) => {
    const me = publicUser(users.get(req.userId));
    const real = users.get(req.realUserId);
    res.json({
      ...me,
      maintenance: maintenance.list(),
      isOwner: me.id === OWNER_ID,
      viewingAs: req.realUserId !== req.userId,
      realUser: { id: real.id, name: real.name, isAdmin: Boolean(real.is_admin) },
    });
  });

  const meUpdate = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    modules: moduleIds.optional(),
    onboarded: z.literal(true).optional(),
  }).strict();

  app.put('/api/me', (req, res) => {
    const parsed = meUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
    const { name, modules, onboarded } = parsed.data;
    const fields = {};
    if (name !== undefined) fields.name = name;
    if (modules !== undefined) fields.modules = JSON.stringify(modules);
    if (onboarded && !users.get(req.userId).onboarded_at) fields.onboarded_at = new Date().toISOString();
    res.json(publicUser(users.update(req.userId, fields)));
  });

  // ─── Admin ────────────────────────────────────────────────────────────────
  app.use('/api/admin', (req, res, next) => {
    if (!users.get(req.realUserId)?.is_admin) return res.status(403).json({ error: 'Só o admin do Hub.' });
    next();
  });

  app.get('/api/admin/users', (_req, res) => {
    const keyCounts = users.keyCounts();
    const secretNames = users.secretNames();
    res.json(users.list().map((u) => ({
      ...publicUser(u),
      keyCount: keyCounts[u.id] ?? 0,
      ...runAsUser(u.id, () => ({
        // Asked the same way the syncs ask. Only whether — never the credential.
        integrations: {
          sigaa: readSigaaConfig() !== null,
          ai: (secretNames[u.id] ?? []).some((name) => name.startsWith('ai.')),
        },
        // Where they study and which system they asked for — not secret, and it's
        // how a request for an unsupported system reaches the admin. The owner
        // predates the question and studies at the IFSC.
        college: parseJson(kvStore.get('college.connection')) ?? (u.id === OWNER_ID ? { institution: 'ifsc' } : null),
        // Each sync's last result for this user — the admin's view of everyone's health.
        lastSync: {
          sigaa: parseJson(kvStore.get('college.sigaa.lastSync')),
        },
      })),
    })));
  });

  const optionalText = (max) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
  const adminCreate = z.object({
    name: z.string().trim().min(1).max(80),
    email: optionalText(120),
  }).strict();

  app.post('/api/admin/users', (req, res) => {
    const parsed = adminCreate.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Informe ao menos o nome.' });
    try {
      res.status(201).json(publicUser(users.create(parsed.data)));
    } catch (err) {
      sendWriteError(res, err);
    }
  });

  const adminUpdate = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    email: optionalText(120),
    tailscaleLogin: optionalText(120),
    disabled: z.boolean().optional(),
    /** Sends the user through the first access again (testing it, or a fresh start). */
    resetOnboarding: z.literal(true).optional(),
  }).strict();

  app.put('/api/admin/users/:id', (req, res) => {
    const id = Number(req.params.id);
    const user = users.get(id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const parsed = adminUpdate.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos.' });
    const { name, email, tailscaleLogin, disabled, resetOnboarding } = parsed.data;
    // Disabling oneself or the owner would lock the only admin out of the panel.
    if (disabled !== undefined && (id === OWNER_ID || id === req.realUserId)) {
      return res.status(400).json({ error: 'O dono do Olimpo não pode ser desativado.' });
    }
    const fields = {};
    if (name !== undefined) fields.name = name;
    if (email !== undefined) fields.email = email;
    if (tailscaleLogin !== undefined) fields.tailscale_login = tailscaleLogin;
    if (resetOnboarding) fields.onboarded_at = null;
    if (disabled !== undefined) fields.disabled_at = disabled ? (user.disabled_at ?? new Date().toISOString()) : null;
    try {
      res.json(publicUser(users.update(id, fields)));
    } catch (err) {
      sendWriteError(res, err);
    }
  });

  // ─── Módulo em manutenção ─────────────────────────────────────────────────
  const maintenanceBody = z.object({ message: z.string().trim().min(1).max(300) }).strict();

  app.put('/api/admin/maintenance/:moduleId', (req, res) => {
    const moduleId = req.params.moduleId;
    if (!MODULE_ID.test(moduleId)) return res.status(400).json({ error: 'Módulo inválido.' });
    const parsed = maintenanceBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Escreva o recado que as pessoas vão ver.' });
    maintenance.set(moduleId, parsed.data.message);
    res.json(maintenance.list());
  });

  app.delete('/api/admin/maintenance/:moduleId', (req, res) => {
    maintenance.clear(req.params.moduleId);
    res.json(maintenance.list());
  });

  app.post('/api/admin/view-as', (req, res) => {
    const id = Number(req.body?.userId);
    if (!users.get(id)) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (id === req.realUserId) {
      res.clearCookie(VIEW_AS_COOKIE, { path: '/' });
    } else {
      res.cookie(VIEW_AS_COOKIE, String(id), { path: '/', httpOnly: true, sameSite: 'strict' });
    }
    res.json({ ok: true });
  });

  app.delete('/api/admin/view-as', (_req, res) => {
    res.clearCookie(VIEW_AS_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // ─── Device certificates (F4) ─────────────────────────────────────────────
  // Which certificate is whose on the public port. Only reachable through
  // Tailscale (PRIVATE_ONLY_PREFIXES covers /api/admin): a device can't
  // register itself from the internet.
  // Either the certificate itself (what Cloudflare shows after signing — the
  // panel's way) or its fingerprint (scripts, tests). From the PEM the server
  // reads the fingerprint and the expiry, so nobody copies them by hand.
  const certBody = z.object({
    userId: z.number().int().positive(),
    label: z.string().trim().min(1).max(80),
    certificate: z.string().trim().max(10_000).optional(),
    fingerprint: z.string().trim().max(120).optional(),
    notAfter: z.string().datetime({ offset: true }).optional(),
  }).strict();

  function readPem(pem) {
    try {
      const cert = new X509Certificate(pem);
      return { fingerprint: cert.fingerprint256, notAfter: new Date(cert.validTo).toISOString() };
    } catch {
      return null;
    }
  }

  const publicCert = (cert) => ({
    fingerprint: cert.fingerprint,
    userId: cert.user_id,
    label: cert.label,
    notAfter: cert.not_after,
    createdAt: cert.created_at,
    revokedAt: cert.revoked_at,
  });

  app.get('/api/admin/certs', (_req, res) => {
    res.json(clientCerts.list().map(publicCert));
  });

  app.post('/api/admin/certs', (req, res) => {
    const parsed = certBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Dados do certificado inválidos.' });
    const { userId, label } = parsed.data;
    let { fingerprint, notAfter } = parsed.data;
    if (parsed.data.certificate) {
      const read = readPem(parsed.data.certificate);
      if (!read) return res.status(400).json({ error: 'Isso não é um certificado — cole o bloco inteiro, de BEGIN CERTIFICATE a END CERTIFICATE.' });
      ({ fingerprint, notAfter } = read);
    }
    if (!/^[0-9a-f]{64}$/.test(normalizeFingerprint(fingerprint))) {
      return res.status(400).json({ error: 'A impressão digital precisa ser o SHA-256 do certificado (64 dígitos hexadecimais).' });
    }
    if (!users.get(userId)) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (clientCerts.get(fingerprint)) return res.status(409).json({ error: 'Esse certificado já está cadastrado.' });
    res.status(201).json(publicCert(clientCerts.add({ fingerprint, userId, label, notAfter })));
  });

  /** Whether the panel can issue certificates by itself (Cloudflare API configured). */
  app.get('/api/admin/certs/generator', (_req, res) => {
    res.json({ available: generatorAvailable() });
  });

  const generateBody = z.object({
    userId: z.number().int().positive(),
    label: z.string().trim().min(1).max(80),
  }).strict();

  // The response carries the .p12 and its password — the only time they exist.
  // Nothing of it is stored; this route only answers through Tailscale.
  app.post('/api/admin/certs/generate', async (req, res) => {
    if (!generatorAvailable()) return res.status(409).json({ error: 'Falta configurar a API da Cloudflare no servidor (CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID).' });
    const parsed = generateBody.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Escolha a pessoa e dê um nome ao aparelho.' });
    const { userId, label } = parsed.data;
    if (!users.get(userId)) return res.status(404).json({ error: 'Usuário não encontrado.' });
    try {
      const issued = await issueDeviceCertificate(label);
      const cert = clientCerts.add({ fingerprint: issued.fingerprint, userId, label, notAfter: issued.notAfter, cloudflareId: issued.cloudflareId });
      res.status(201).json({ ...publicCert(cert), p12: issued.p12.toString('base64'), password: issued.password });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  app.delete('/api/admin/certs/:fingerprint', async (req, res) => {
    const cert = clientCerts.get(req.params.fingerprint);
    if (!cert || !clientCerts.revoke(req.params.fingerprint)) return res.status(404).json({ error: 'Certificado não encontrado ou já revogado.' });
    // Revoked here first, so the Olimpo refuses it whatever Cloudflare says;
    // there, it also stops at the edge. A failure there is reported, not hidden.
    let cloudflareError = null;
    if (cert.cloudflare_id && generatorAvailable()) {
      try {
        await revokeAtCloudflare(cert.cloudflare_id);
      } catch (err) {
        cloudflareError = err.message;
      }
    }
    res.json({ ...publicCert(clientCerts.get(req.params.fingerprint)), cloudflareError });
  });
}
