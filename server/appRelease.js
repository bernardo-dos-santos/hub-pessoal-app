/**
 * appRelease.js — the Android APK's self-update.
 *
 * The admin publishes a build from the notebook (`npm run apk:release` →
 * POST /api/admin/app/android); every user's app asks /api/app/android/latest,
 * compares with what's installed (AppUpdatePlugin) and offers "Atualizar".
 * Publishing also sends a push to everyone's devices, so nobody has to forward
 * an APK over WhatsApp.
 *
 * Files live in data/app/android/ (outside public/ and dist/: served only
 * through /api, behind the same access as everything else). The last few
 * versions stay, so a bad build can be rolled back by republishing.
 */

import express from 'express';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './pendingFiles.js';
import { users } from './db.js';
import { runAsUser } from './userContext.js';
import { sendPushNotifications } from './push.js';

const APP_DIR = join(DATA_DIR, 'app', 'android');
const LATEST = join(APP_DIR, 'latest.json');
const KEEP_VERSIONS = 3;
const APK_TYPE = 'application/vnd.android.package-archive';

function readLatest() {
  if (!existsSync(LATEST)) return null;
  try {
    return JSON.parse(readFileSync(LATEST, 'utf-8'));
  } catch {
    return null;
  }
}

function apkPath(versionCode) {
  return join(APP_DIR, `hub-${versionCode}.apk`);
}

function pruneOldVersions(keepFrom) {
  const versions = readdirSync(APP_DIR)
    .map((f) => /^hub-(\d+)\.apk$/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => b - a);
  for (const old of versions.filter((v) => v !== keepFrom).slice(KEEP_VERSIONS - 1)) unlinkSync(apkPath(old));
}

/** Tells every active user's devices — each one's own, inside their user context. */
async function announce(release) {
  for (const user of users.list().filter((u) => !u.disabled_at)) {
    await runAsUser(user.id, () => sendPushNotifications([{
      title: 'Nova versão do Hub',
      body: `Versão ${release.versionName} disponível — abra o app e toque em Atualizar.`,
      url: '/',
    }]));
  }
}

export function registerAppReleaseRoutes(app) {
  app.get('/api/app/android/latest', (_req, res) => {
    const latest = readLatest();
    if (!latest) return res.status(404).json({ error: 'Nenhuma versão publicada.' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(latest);
  });

  app.get('/api/app/android/apk', (_req, res) => {
    const latest = readLatest();
    const file = latest && apkPath(latest.versionCode);
    if (!file || !existsSync(file)) return res.status(404).json({ error: 'Nenhuma versão publicada.' });
    res.setHeader('Content-Type', APK_TYPE);
    res.setHeader('Content-Length', String(statSync(file).size));
    res.setHeader('Content-Disposition', `attachment; filename="hub-${latest.versionCode}.apk"`);
    createReadStream(file).pipe(res);
  });

  // Admin only: /api/admin is guarded in usersApi.js (registered before this).
  app.post('/api/admin/app/android', express.raw({ type: APK_TYPE, limit: '120mb' }), async (req, res) => {
    const versionCode = Number(req.query.versionCode);
    const versionName = String(req.query.versionName ?? '').slice(0, 60);
    const notes = String(req.query.notes ?? '').slice(0, 300);
    if (!Number.isInteger(versionCode) || versionCode < 1 || !versionName) {
      return res.status(400).json({ error: 'versionCode (inteiro) e versionName são obrigatórios.' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length < 1024) return res.status(400).json({ error: 'Envie o APK no corpo.' });
    // "PK" — an APK is a zip. Cheap check that this isn't an error page uploaded by mistake.
    if (req.body[0] !== 0x50 || req.body[1] !== 0x4b) return res.status(400).json({ error: 'O arquivo enviado não é um APK.' });

    const current = readLatest();
    if (current && versionCode <= current.versionCode) {
      return res.status(409).json({ error: `Já existe a versão ${current.versionCode}; a nova precisa ser maior (faça um commit antes de publicar).` });
    }

    mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(apkPath(versionCode), req.body);
    const release = {
      versionCode,
      versionName,
      notes,
      size: req.body.length,
      sha256: createHash('sha256').update(req.body).digest('hex'),
      publishedAt: new Date().toISOString(),
    };
    writeFileSync(LATEST, JSON.stringify(release, null, 2));
    pruneOldVersions(versionCode);
    res.status(201).json(release);
    void announce(release).catch((err) => console.warn('[app-release] aviso por push falhou:', err.message));
  });
}
