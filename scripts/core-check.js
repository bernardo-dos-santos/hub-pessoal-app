// Check de invariantes do core — as que não pertencem a nenhum módulo e cujo
// erro é silencioso o suficiente para nenhuma tela denunciar.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectRetained } from "./lib/backupRetention.js";
import { certificatesHealth, jobsHealth } from "../server/systemHealth.js";
import { isStudyPlanInUse, isTrainingInUse } from '../src/shared/activity/recentActivity.js';

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

// Só o APK pode apontar para outro servidor por conta própria; na web a base tem
// de ficar relativa, para o proxy do Vite mandar ao backend local. A decisão vive
// em chooseBackendBase(), e o bootstrap não pode contorná-la.
const bootstrapSource = fs.readFileSync(corePath("storage", "bootstrapStore.ts"), "utf8");
assert.equal(
  /setBackendBase\(/.test(bootstrapSource),
  false,
  "bootstrapStore não define a base por conta própria — só via chooseBackendBase()",
);
assert.ok(bootstrapSource.includes("await chooseBackendBase()"), "bootstrapStore escolhe a base com chooseBackendBase()");
const chooseBody = backendConfigSource.slice(backendConfigSource.indexOf("export async function chooseBackendBase"));
assert.ok(
  /^[^{]*\{\s*if \(!isCapacitorApp\(\)\) \{\s*setBackendBase\(''\);\s*return 'same-origin';/.test(chooseBody),
  "chooseBackendBase precisa, antes de tudo, deixar a base relativa fora do APK",
);

// Retenção do backup: 7 diários + o mais novo de 4 semanas + o de 6 meses.
// Um backup por dia durante um ano — o que sobra tem de alcançar meses atrás.
const daily = Array.from({ length: 365 }, (_, i) => ({
  id: `d${i}`,
  createdTime: new Date(Date.UTC(2026, 9, 6) - i * 86_400_000).toISOString(),
}));
const kept = selectRetained(daily);
for (let i = 0; i < 7; i++) assert.ok(kept.has(`d${i}`), `o backup de ${i} dia(s) atrás deve ficar`);
const oldestKept = Math.max(...[...kept].map((id) => Number(id.slice(1))));
// 6 meses contando o atual: o mais antigo mantido é o último dia do 6º mês para trás.
assert.ok(oldestKept >= 120, `algum backup de ~4 meses atrás deve sobreviver (mais antigo mantido: ${oldestKept} dias)`);
assert.ok(kept.size <= 7 + 4 + 6, `retenção não pode crescer sem limite (${kept.size} mantidos)`);
assert.equal(selectRetained(daily.slice(0, 3)).size, 3, "com poucos backups, nenhum é apagado");

// Lembrete só do que a pessoa está fazendo: plano parado e treino abandonado ficam quietos.
{
  const today = new Date(2026, 10, 8);
  assert.equal(isStudyPlanInUse({ '2026-06-23:0': 'done' }, today), false, 'plano de junho não conta como seguido em novembro');
  assert.equal(isStudyPlanInUse({ '2026-11-02:3': 'partial' }, today), true, 'sessão marcada nesta semana conta');
  assert.equal(isStudyPlanInUse({ '2026-11-02:3': 'skipped' }, today), false, 'pular não é seguir o plano');
  assert.equal(isStudyPlanInUse({}, today), false);
  assert.equal(isTrainingInUse(6), true, 'uma semana sem treino ainda vale o lembrete');
  assert.equal(isTrainingInUse(96), false, '96 dias sem treino não é lembrete, é ruído');
}

// Saúde dos jobs: silêncio além de 2× a cadência conta como falha.
const now = Date.UTC(2026, 9, 6, 12);
const hoursAgo = (h) => new Date(now - h * 3_600_000).toISOString();
const health = Object.fromEntries(jobsHealth([
  { script: "sigaa-sync", level: "error", message: "anti-bot", timestamp: hoursAgo(1) },
  { script: "sigaa-sync", level: "success", message: "ok", timestamp: hoursAgo(25) },
  { script: "gdrive-backup", level: "success", message: "ok", timestamp: hoursAgo(49) },
  { script: "send-daily-push", level: "info", message: "rodou", timestamp: hoursAgo(3) },
  { script: "nubank-invoice-gmail-sync", level: "success", message: "ok", timestamp: hoursAgo(24 * 40) },
  { script: "generate-monthly-finance-summary", level: "success", message: "ok", timestamp: hoursAgo(24 * 90) },
], now).map((j) => [j.script, j.status]));
assert.equal(health["sigaa-sync"], "error", "último desfecho com erro deve aparecer como erro, mesmo com sucesso antes");
assert.equal(health["gdrive-backup"], "stale", "job diário sem registro há mais de 48h está parado");
assert.equal(health["send-daily-push"], "ok", "registro recente, sem erro, é ok");
assert.equal(health["nubank-invoice-gmail-sync"], "ok", "job mensal com 40 dias de silêncio ainda está dentro de 2× a cadência");
assert.equal(health["generate-monthly-finance-summary"], "stale", "job mensal sem registro há 90 dias está parado");
assert.equal(health["calendar-sync"], "unknown", "job que nunca registrou nada não é afirmado nem bom nem ruim");

// Certificados de aparelho: avisa antes de vencer, e o vencido trava a pessoa
// fora sem erro nenhum na tela dela (a Cloudflare bloqueia antes).
const daysFromNow = (d) => new Date(now + d * 86_400_000).toISOString();
const certs = certificatesHealth([
  { label: "Celular da Ana", user_id: 2, not_after: daysFromNow(10), revoked_at: null },
  { label: "Notebook velho", user_id: 2, not_after: daysFromNow(-3), revoked_at: null },
  { label: "Celular novo", user_id: 1, not_after: daysFromNow(300), revoked_at: null },
  { label: "Revogado", user_id: 1, not_after: daysFromNow(-30), revoked_at: daysFromNow(-60) },
], (id) => (id === 2 ? "Ana" : "Bernardo"), now);
assert.deepEqual(certs.map((c) => [c.label, c.status, c.userName]), [
  ["Celular da Ana", "expiring", "Ana"],
  ["Notebook velho", "expired", "Ana"],
], "só entram os que vencem em menos de 30 dias ou já venceram; revogado não conta");

console.log("Core check passed.");
