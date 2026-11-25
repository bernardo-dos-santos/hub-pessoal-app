/**
 * generate-weekly-plan.js
 * Dispara a geração server-side do plano semanal.
 * Agendar via Task Scheduler: todo domingo às 21h.
 *
 * Uso:
 *   node scripts/schedule/generate-weekly-plan.js
 *
 * Não precisa de chave: quem escolhe o provedor e a credencial é o servidor,
 * pela cadeia de slots configurada em Configurações → IA.
 *
 * Agendado por scripts/schedule/setup-all-tasks.ps1.
 */

import { createLogger } from '../lib/logger.js';
import { HUB_URL, waitForHub } from '../lib/hubApi.js';

const log = createLogger('generate-weekly-plan');


async function main() {
  log.info('Iniciando geração do plano semanal...');

  try {
    await waitForHub({ log });
    const res = await fetch(`${HUB_URL}/api/planner/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      log.error(`Falha ao gerar plano: ${data.error ?? `HTTP ${res.status}`}`);
      process.exitCode = 1;
      return;
    }

    if (data.skipped) log.success(`Plano não gerado: ${data.reason}`);
    else log.success(`Plano gerado: ${data.sessions} sessões para a semana de ${data.weekOf}`);
  } catch (err) {
    // exitCode em vez de exit(1) — ver generate-briefing.js.
    log.error('Não foi possível conectar ao servidor do Hub', err);
    process.exitCode = 1;
  }
}

main();
