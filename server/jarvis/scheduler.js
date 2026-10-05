/**
 * jarvis/scheduler.js — dispara o tick proativo periodicamente. Agendamento
 * in-process: o hub-server já roda 24/7 sob PM2, então não há necessidade de
 * abrir um processo novo via Task Scheduler pra isso (custaria mais e não
 * daria nada em troca — o gate dentro do tick já é o que mantém o custo baixo
 * em dia parado, não a cadência externa).
 *
 * Corrente de setTimeout em vez de setInterval de propósito: o intervalo vem
 * da config e pode mudar quando o usuário troca de preset. Com setInterval a
 * cadência ficaria congelada no valor lido no boot, e trocar de preset só
 * valeria depois de reiniciar o servidor.
 */

import { runInitiativeTick } from './initiative.js';
import { getJarvisConfig } from './config.js';

/** Timer do próximo tick, ou null enquanto um tick está rodando. */
let timer = null;

function scheduleNext() {
  const { tick } = getJarvisConfig();
  const delayMs = Math.max(1, tick.intervalMinutes) * 60_000;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runInitiativeTick()
      .catch((err) => console.error('[jarvis] tick proativo falhou:', err))
      .finally(scheduleNext);
  }, delayMs);
  timer.unref?.();
}

/**
 * Reagenda com o intervalo que está na config AGORA.
 *
 * Sem isto, mudar o intervalo na tela só valia depois do disparo seguinte:
 * quem estava em 90min e escolhia 15min esperava até 90 minutos para a
 * primeira verificação nova — o dial parecia não ter efeito. Devolve false
 * quando um tick está em execução, porque nesse caso não há timer para
 * cancelar e o `finally` já vai reagendar lendo o valor novo.
 */
export function rescheduleJarvisTick() {
  if (!timer) return false;
  scheduleNext();
  return true;
}

export function startJarvisScheduler() {
  const { tick } = getJarvisConfig();
  scheduleNext();
  console.log(`[jarvis] scheduler iniciado — tick a cada ${tick.intervalMinutes}min, janela ${tick.windowStart}h–${tick.windowEnd}h, ${tick.dailyBudget} por dia.`);
}
