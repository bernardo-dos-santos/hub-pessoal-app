/**
 * publish-apk.mjs — sends the APK just built to the Hub server, where every
 * user's app finds it and offers "Atualizar" (server/appRelease.js).
 *
 *   npm run apk:release -- "o que mudou"     (build + publish)
 *   node scripts/publish-apk.mjs "o que mudou"  (publish the last build)
 *
 * The version comes from Gradle's output-metadata.json, written by the build
 * with the numbers scripts/build-apk.js passed in. Admin only on the server.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'android/app/build/outputs/apk/debug');
// Same address the APK uses (src/core/config/backendConfig.ts).
const SERVER = process.env.HUB_PUBLISH_URL ?? process.env.HUB_BACKEND;

const metadata = JSON.parse(readFileSync(resolve(OUT, 'output-metadata.json'), 'utf-8'));
const { versionCode, versionName, outputFile } = metadata.elements[0];
const apk = readFileSync(resolve(OUT, outputFile));
const notes = process.argv.slice(2).join(' ');

const query = new URLSearchParams({ versionCode: String(versionCode), versionName, notes });
console.log(`[publish-apk] Enviando versão ${versionName} (${(apk.length / 1e6).toFixed(1)} MB)…`);
const res = await fetch(`${SERVER}/api/admin/app/android?${query}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/vnd.android.package-archive' },
  body: apk,
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`[publish-apk] Recusado (${res.status}): ${body.error ?? 'sem detalhe'}`);
  process.exit(1);
}
console.log(`[publish-apk] Publicada a versão ${body.versionName}. Os celulares recebem o aviso por push.`);
