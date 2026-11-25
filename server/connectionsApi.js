/**
 * connectionsApi.js — Configurações → Conexões: each user's own integrations.
 *
 * Every route acts on the current user (req.userId, already inside runAsUser).
 * Credentials go in and never come back out: GET only says what is connected
 * and asks the provider, live, whether it still works.
 */

import { z } from 'zod';
import { encryptionAvailable } from './crypto.js';
import { clearSigaa, readSigaaConfig, saveSigaaCredentials } from './connections/sigaa.js';

export function registerConnectionRoutes(app) {
  // ─── SIGAA (IFSC) ─────────────────────────────────────────────────────────
  app.get('/api/connections/sigaa', (_req, res) => {
    // Only whether — the login itself stays on the server too.
    res.json({ configured: readSigaaConfig() !== null });
  });

  const sigaaCredentials = z.object({
    login: z.string().trim().min(3).max(120),
    password: z.string().min(1).max(200),
  }).strict();

  app.put('/api/connections/sigaa/credentials', (req, res) => {
    if (!encryptionAvailable()) return res.status(503).json({ error: 'O servidor não tem chave de cifra configurada — fale com o admin.' });
    const parsed = sigaaCredentials.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Preencha o usuário e a senha do SIGAA.' });
    saveSigaaCredentials(parsed.data.login, parsed.data.password);
    res.json({ ok: true });
  });

  app.delete('/api/connections/sigaa', (_req, res) => {
    clearSigaa();
    res.json({ ok: true });
  });
}
