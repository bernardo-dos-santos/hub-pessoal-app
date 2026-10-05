/**
 * generate-briefing.js
 * Gera o briefing diário usando IA e salva em public/briefing-today.json.
 * Agendar via Task Scheduler: todo dia às 06h00.
 *
 * Uso:
 *   node scripts/schedule/generate-briefing.js
 *
 * Não precisa de chave: quem escolhe o provedor e a credencial é o servidor,
 * pela cadeia de slots configurada em Configurações → IA.
 *
 * Task Scheduler (PowerShell como admin):
 *   $action = New-ScheduledTaskAction -Execute "node" -Argument `
 *     '"C:\Users\Bernardo\Documents\Finance App\scripts\schedule\generate-briefing.js"' `
 *     -WorkingDirectory "C:\Users\Bernardo\Documents\Finance App"
 *   $trigger = New-ScheduledTaskTrigger -Daily -At "06:00"
 *   Register-ScheduledTask -TaskName "HubPessoal-Briefing" -Action $action -Trigger $trigger -RunLevel Highest
 */

import { createLogger } from '../lib/logger.js';

const log = createLogger('generate-briefing');

// 127.0.0.1, não "localhost": o servidor só escuta em 0.0.0.0 (IPv4). Se o
// fetch nativo do Node resolver "localhost" pra IPv6 (::1) primeiro, a
// conexão falha sem fallback pra IPv4 — foi isso que deixou o briefing sem
// rodar desde 24/06 (Task Scheduler registrava só um crash 0xC0000409).
const HUB_URL = process.env.HUB_BACKEND ?? 'http://127.0.0.1:3001';

async function main() {
  log.info('Gerando morning briefing...');

  try {
    const res = await fetch(`${HUB_URL}/api/briefing/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      log.error(`Falha ao gerar briefing: ${data.error ?? `HTTP ${res.status}`}`);
      process.exitCode = 1;
      return;
    }

    log.success('Briefing do dia gerado com sucesso.');
  } catch (err) {
    // exitCode em vez de exit(1): chamar process.exit() logo após um fetch
    // que falhou colide com um bug do Node/libuv no Windows (assertion em
    // src\win\async.c) e crasha o processo em vez de sair limpo — foi
    // exatamente esse crash que aparecia como 0xC0000409 no Task Scheduler.
    log.error('Não foi possível conectar ao servidor do Hub', err);
    process.exitCode = 1;
  }
}

main();
