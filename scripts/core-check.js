// Check de invariantes do core — as que não pertencem a nenhum módulo e cujo
// erro é silencioso o suficiente para nenhuma tela denunciar.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const corePath = (...parts) => path.join(projectRoot, "src", "core", ...parts);

// ─── Detecção de APK ──────────────────────────────────────────────────────────
//
// Regressão real, corrigida em 2026-08-17: isCapacitorApp() checava apenas
// `'Capacitor' in window`. Mas @capacitor/core executa
// `win.Capacitor = createCapacitor(win)` ao CARREGAR, em qualquer ambiente, e
// ele entra no bundle web porque JarvisChat importa câmera/localização/share e
// o painel do Jarvis é global no AppLayout.
//
// Resultado: no navegador a função dizia "sou o APK", o bootstrapStore apontava
// o backend para o Tailscale, e `npm run dev` passava a ler e ESCREVER no
// hub.db de produção — sem nada na tela indicando isso.

const backendConfigSource = fs.readFileSync(corePath("config", "backendConfig.ts"), "utf8");

assert.equal(
  /['"]Capacitor['"]\s+in\s+window/.test(backendConfigSource),
  false,
  "isCapacitorApp NAO pode detectar APK por `'Capacitor' in window` — o global existe também na web, e o dev acaba escrevendo em produção",
);
assert.equal(
  backendConfigSource.includes("Capacitor.isNativePlatform()"),
  true,
  "isCapacitorApp deve perguntar ao Capacitor com isNativePlatform(), que é o único sinal que distingue APK de navegador",
);

// Só o APK pode apontar para o Tailscale por conta própria; na web a base tem
// de ficar relativa, para o proxy do Vite mandar ao backend local.
const bootstrapSource = fs.readFileSync(corePath("storage", "bootstrapStore.ts"), "utf8");
assert.equal(
  /setBackendBase\(TAILSCALE_BACKEND\)/.test(bootstrapSource)
    && /isCapacitorApp\(\)\s*\)?\s*setBackendBase\(TAILSCALE_BACKEND\)/.test(bootstrapSource.replace(/\s+/g, " ")),
  true,
  "bootstrapStore só pode apontar para o Tailscale sob isCapacitorApp()",
);

console.log("Core check passed.");
