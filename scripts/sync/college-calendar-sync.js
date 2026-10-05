/**
 * college-calendar-sync.js
 * Exporta provas e entregas da Faculdade para o Google Calendar, pra aparecerem
 * no celular sem depender de abrir o Hub.
 *
 * Uso:
 *   node scripts/sync/college-calendar-sync.js
 *   node scripts/sync/college-calendar-sync.js --dry-run
 *
 * Pré-requisito: token.json já autorizado. O escopo necessário
 * ('https://www.googleapis.com/auth/calendar') já está em authorize-google.js,
 * então normalmente NÃO é preciso reautorizar.
 *
 * Diferente do calendar-sync.js (plano semanal), aqui não dá pra apagar-e-recriar:
 * prazos se espalham por meses e recriar mudaria o id do evento a cada execução
 * (perdendo lembretes ajustados na mão). Cada item carrega um hub_college_id em
 * extendedProperties e a sincronização é incremental: cria o que falta, atualiza o
 * que mudou, apaga o que sumiu do Hub.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createLogger } from '../lib/logger.js';
import { notifySyncFailure } from '../lib/notify.js';
import { listAllEvents, insertEvent, updateEvent, deleteEvent } from '../../server/google.js';

const log = createLogger('college-calendar-sync');
const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = resolve(__dirname, '../../hub.db');

const TAG = '[Hub Faculdade]';
const PROP_KEY = 'hub_college_id';
// Prazo passado não interessa mais e só polui a agenda; sincroniza a partir de
// alguns dias atrás pra não sumir com o que acabou de vencer.
const PAST_DAYS_WINDOW = 7;

const DRY_RUN = process.argv.includes('--dry-run');

function readKv(db, key) {
  const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

/** 'YYYY-MM-DD' a partir de uma data que pode vir com hora ('...T23:59:00'). */
function toDateOnly(value) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Junta provas e tarefas num formato único de "compromisso com data".
 * Evento de dia inteiro: prazo é data, não horário — e all-day aparece no topo
 * do dia na agenda, que é onde um prazo deve estar.
 */
function collectItems(db) {
  const subjects = readKv(db, 'college.subjects') ?? [];
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name ?? null;
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -PAST_DAYS_WINDOW);
  const items = [];

  for (const a of readKv(db, 'college.assessments') ?? []) {
    const date = toDateOnly(a.date);
    if (!date || date < cutoff || a.status === 'missed') continue;
    const subject = subjectName(a.subjectId);
    items.push({
      key: `assessment:${a.id}`,
      date,
      summary: `${TAG} ${subject ? `${subject}: ` : ''}${a.title}`,
      description: [a.notes, 'Avaliação — gerado pelo Hub Pessoal.'].filter(Boolean).join('\n'),
      colorId: '11', // tomato — prova é o que não pode passar batido
    });
  }

  for (const t of readKv(db, 'college.tasks') ?? []) {
    const date = toDateOnly(t.dueDate);
    if (!date || date < cutoff || t.status === 'done' || t.status === 'canceled') continue;
    const subject = subjectName(t.subjectId);
    items.push({
      key: `task:${t.id}`,
      date,
      summary: `${TAG} ${subject ? `${subject}: ` : ''}${t.title}`,
      description: [t.description, 'Entrega — gerado pelo Hub Pessoal.'].filter(Boolean).join('\n'),
      colorId: '5', // banana
    });
  }

  return items;
}

function toEvent(item) {
  return {
    summary: item.summary,
    description: item.description,
    start: { date: item.date },
    end: { date: addDays(item.date, 1) }, // all-day: fim é exclusivo
    colorId: item.colorId,
    extendedProperties: { private: { [PROP_KEY]: item.key } },
  };
}

/** Eventos já criados por este script, indexados pelo hub_college_id. */
async function listExisting() {
  const events = await listAllEvents({
    privateExtendedProperty: `${PROP_KEY}=*`,
    timeMin: new Date(Date.now() - 365 * 86_400_000).toISOString(),
    maxResults: 250,
  });
  const existing = new Map();
  for (const ev of events) {
    const key = ev.extendedProperties?.private?.[PROP_KEY];
    if (key) existing.set(key, ev);
  }
  return existing;
}

function needsUpdate(event, item) {
  return event.summary !== item.summary
    || event.start?.date !== item.date
    || (event.description ?? '') !== item.description;
}

async function main() {
  if (!existsSync(DB_PATH)) throw new Error(`Banco não encontrado em ${DB_PATH}.`);
  const db = new DatabaseSync(DB_PATH);
  const items = collectItems(db);
  db.close();

  const existing = await listExisting();

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const item of items) {
    const current = existing.get(item.key);
    if (!current) {
      if (!DRY_RUN) await insertEvent(toEvent(item));
      created++;
      log.info(`criar: ${item.summary} (${item.date})`);
    } else if (needsUpdate(current, item)) {
      if (!DRY_RUN) await updateEvent(current.id, toEvent(item));
      updated++;
      log.info(`atualizar: ${item.summary} (${item.date})`);
    }
  }

  // Some do Hub (concluído, apagado, semestre encerrado) → some da agenda.
  const liveKeys = new Set(items.map((i) => i.key));
  for (const [key, event] of existing) {
    if (liveKeys.has(key)) continue;
    if (!DRY_RUN) await deleteEvent(event.id);
    removed++;
    log.info(`remover: ${event.summary}`);
  }

  log.info(`${DRY_RUN ? '[dry-run] ' : ''}${items.length} item(ns) no Hub — ${created} criado(s), ${updated} atualizado(s), ${removed} removido(s).`);
}

main().catch(async (err) => {
  log.error(`Falhou: ${err.message}`);
  await notifySyncFailure('college-calendar-sync', err).catch(() => {});
  process.exit(1);
});
