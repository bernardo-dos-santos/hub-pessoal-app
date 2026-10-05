/**
 * generate-monthly-finance-summary.js
 * Gera o resumo financeiro mensal com IA e salva no store.
 * Agendar via Task Scheduler: dia 06 de cada mês às 00:30.
 *
 * Uso:
 *   node scripts/schedule/generate-monthly-finance-summary.js
 *   # Mês específico:
 *   node scripts/schedule/generate-monthly-finance-summary.js 2026-05
 *
 * Não precisa de chave: quem escolhe o provedor e a credencial é o servidor,
 * pela cadeia de slots configurada em Configurações → IA.
 *
 * Task Scheduler (PowerShell como admin):
 *   $action = New-ScheduledTaskAction -Execute "node" `
 *     -Argument '"C:\Users\Bernardo\Documents\Finance App\scripts\schedule\generate-monthly-finance-summary.js"' `
 *     -WorkingDirectory "C:\Users\Bernardo\Documents\Finance App"
 *   $trigger = New-ScheduledTaskTrigger -Monthly -DaysOfMonth 6 -At "00:30"
 *   Register-ScheduledTask -TaskName "HubPessoal-MonthlySummary" -Action $action -Trigger $trigger -RunLevel Highest
 */

import { createLogger } from '../lib/logger.js';

const log = createLogger('generate-monthly-finance-summary');

// 127.0.0.1, não "localhost" — ver generate-briefing.js: o servidor só
// escuta em IPv4 (0.0.0.0) e "localhost" pode resolver IPv6 primeiro.
const HUB_URL = process.env.HUB_BACKEND ?? 'http://127.0.0.1:3001';
const MONTH   = process.argv[2] ?? null; // opcional: YYYY-MM

async function main() {
  const label = MONTH ? `mês ${MONTH}` : 'mês anterior';
  log.info(`Gerando resumo financeiro de ${label}...`);

  try {
    const res = await fetch(`${HUB_URL}/api/finance/monthly-summary/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: MONTH }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      log.error(`Falha ao gerar resumo: ${data.error ?? `HTTP ${res.status}`}`);
      process.exitCode = 1;
      return;
    }

    log.success(`Resumo de ${data.summary?.month ?? label} gerado com sucesso.`);
  } catch (err) {
    // exitCode em vez de exit(1) — ver generate-briefing.js.
    log.error('Não foi possível conectar ao servidor do Hub', err);
    process.exitCode = 1;
  }
}

main();
