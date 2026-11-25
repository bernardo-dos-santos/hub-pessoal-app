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
 * Agendado por scripts/schedule/setup-all-tasks.ps1.
 */

import { createLogger } from '../lib/logger.js';
import { HUB_URL, waitForHub } from '../lib/hubApi.js';

const log = createLogger('generate-monthly-finance-summary');

const MONTH   = process.argv[2] ?? null; // opcional: YYYY-MM

async function main() {
  const label = MONTH ? `mês ${MONTH}` : 'mês anterior';
  log.info(`Gerando resumo financeiro de ${label}...`);

  try {
    await waitForHub({ log });
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
