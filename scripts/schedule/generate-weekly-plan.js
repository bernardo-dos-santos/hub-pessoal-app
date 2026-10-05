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
 * Task Scheduler (PowerShell como admin):
 *   $action = New-ScheduledTaskAction -Execute "node" -Argument `
 *     '"C:\Users\Bernardo\Documents\Finance App\scripts\schedule\generate-weekly-plan.js"' `
 *     -WorkingDirectory "C:\Users\Bernardo\Documents\Finance App"
 *   $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "21:00"
 *   Register-ScheduledTask -TaskName "HubPessoal-WeeklyPlan" -Action $action -Trigger $trigger -RunLevel Highest
 */

import { createLogger } from '../lib/logger.js';

const log = createLogger('generate-weekly-plan');

// 127.0.0.1, não "localhost" — ver generate-briefing.js: o servidor só
// escuta em IPv4 (0.0.0.0) e "localhost" pode resolver IPv6 primeiro.
const HUB_URL = process.env.HUB_BACKEND ?? 'http://127.0.0.1:3001';

async function main() {
  log.info('Iniciando geração do plano semanal...');

  try {
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

    log.success(`Plano gerado: ${data.sessions} sessões para a semana de ${data.weekOf}`);
  } catch (err) {
    // exitCode em vez de exit(1) — ver generate-briefing.js.
    log.error('Não foi possível conectar ao servidor do Hub', err);
    process.exitCode = 1;
  }
}

main();
