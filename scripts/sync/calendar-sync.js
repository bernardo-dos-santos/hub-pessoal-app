/**
 * calendar-sync.js
 * Exporta o plano semanal do Hub para o Google Calendar.
 * Limpa os eventos da semana anterior criados pelo Hub e cria os novos.
 *
 * Uso:
 *   node scripts/sync/calendar-sync.js
 *
 * Pré-requisito: token OAuth em scripts/config/token.json com o escopo de
 * Calendar. Para gerar ou renovar:
 *   node scripts/sync/authorize-google.js
 * (autoriza Gmail + Drive + Calendar de uma vez e substitui o token existente).
 *
 * Task Scheduler: toda segunda-feira às 07h00 (após generate-weekly-plan de domingo)
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../lib/logger.js';
import { notifySyncFailure } from '../lib/notify.js';
import { DatabaseSync } from 'node:sqlite';
import { hasGoogleAuth, listAllEvents, insertEvent, deleteEvent } from '../../server/google.js';

const log = createLogger('calendar-sync');
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Caminhos ---
const DB_PATH = resolve(__dirname, '../../hub.db');

// --- Configurações ---
const HUB_EVENT_TAG = '[Hub]'; // Prefixo para identificar eventos criados pelo Hub

const WEEK_DAY_TO_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const TYPE_COLOR_ID = {
  study: '9',   // blueberry
  review: '3',  // grape
  train: '2',   // sage
  rest: '8',    // graphite
  admin: '5',   // banana
  other: '1',   // lavender
};

// --- Helpers ---
function getWeeklyPlan() {
  if (!existsSync(DB_PATH)) return null;
  const db = new DatabaseSync(DB_PATH);
  const row = db.prepare("SELECT value FROM kv_store WHERE key = 'study.weeklyPlan'").get();
  db.close();
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

function sessionToEvent(session, weekOf) {
  const [year, month, day] = weekOf.split('-').map(Number);
  const weekStart = new Date(year, month - 1, day);

  const dayOffset = WEEK_DAY_TO_INDEX[session.day] ?? 1;
  const mondayOffset = 1; // weekOf é sempre segunda-feira
  const actualOffset = dayOffset - mondayOffset;
  const eventDate = new Date(weekStart);
  eventDate.setDate(weekStart.getDate() + actualOffset);

  const [hours, minutes] = (session.startTime ?? '08:00').split(':').map(Number);
  const startDt = new Date(eventDate);
  startDt.setHours(hours, minutes, 0, 0);
  const endDt = new Date(startDt.getTime() + (session.durationMinutes ?? 60) * 60000);

  const dateStr = eventDate.toISOString().split('T')[0];

  return {
    summary: `${HUB_EVENT_TAG} ${session.topic}`,
    description: session.reason ? `${session.reason}\nGerado pelo Hub Pessoal.` : 'Gerado pelo Hub Pessoal.',
    start: { dateTime: startDt.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDt.toISOString(), timeZone: 'America/Sao_Paulo' },
    colorId: TYPE_COLOR_ID[session.type] ?? '1',
    extendedProperties: { private: { hub_session_id: session.id ?? '', hub_week: dateStr } },
  };
}

async function deleteHubEvents(weekOf) {
  const [year, month, day] = weekOf.split('-').map(Number);
  const weekStart = new Date(year, month - 1, day);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const events = await listAllEvents({
    timeMin: weekStart.toISOString(),
    timeMax: weekEnd.toISOString(),
    q: HUB_EVENT_TAG,
    maxResults: 100,
  });

  let deletedCount = 0;
  for (const event of events) {
    // A busca `q` é textual e casa com descrição também — só apaga o que este
    // script criou de fato, checando o prefixo no título.
    if (!event.summary?.startsWith(HUB_EVENT_TAG)) continue;
    await deleteEvent(event.id);
    deletedCount++;
  }

  return deletedCount;
}

// --- Main ---
async function main() {
  log.info('Iniciando sincronização do plano semanal com o Google Calendar...');

  const plan = getWeeklyPlan();
  if (!plan?.sessions?.length) {
    log.warn('Nenhum plano semanal encontrado no banco. Execute o generate-weekly-plan.js primeiro.');
    process.exit(0);
  }

  if (!hasGoogleAuth()) {
    log.error('Token do Google ausente. Rode: node scripts/sync/authorize-google.js');
    process.exit(1);
  }

  // Limpar eventos Hub da semana
  const deleted = await deleteHubEvents(plan.weekOf);
  if (deleted > 0) log.info(`${deleted} evento(s) antigos removidos do Calendar.`);

  // Criar novos eventos
  let created = 0;
  for (const session of plan.sessions) {
    try {
      await insertEvent(sessionToEvent(session, plan.weekOf));
      created++;
    } catch (err) {
      log.error(`Falha ao criar evento para "${session.topic}"`, err);
    }
  }

  log.success(`${created}/${plan.sessions.length} evento(s) criado(s) no Google Calendar para a semana de ${plan.weekOf}.`);
}

main().catch(async (err) => {
  log.error('Erro inesperado', err);
  await notifySyncFailure('calendar-sync', err);
  process.exit(1);
});
