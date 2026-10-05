/**
 * jarvis/tools/planner.js — get_planner_day, create_planner_event,
 * delete_planner_event, get_concurso_status, get_weather.
 *
 * Also do_checkin (daily mood/energy/sleep check-in): the Fase 1 design doc's
 * domain-file breakdown didn't list a home for this tool. It doesn't fit
 * finance/study/college/fitness/machine, and memory.js is specifically about
 * long-term facts/goals/audit, not daily state — planner.js already owns the
 * other "day in Bernardo's life" tools (get_planner_day, get_concurso_status),
 * so do_checkin was placed here as the closest functional match.
 */

import { kvStore } from '../../db.js';
import { kv, todayStr, todayWeekDay, daysBetween } from '../context.js';
import { getWeather } from '../../weather.js';

export const plannerTools = [
  {
    name: 'do_checkin',
    description: 'Registra o check-in diário de humor, energia e sono. Use quando Bernardo quiser fazer o check-in ou relatar como está se sentindo.',
    input_schema: {
      type: 'object',
      properties: {
        mood:        { type: 'integer', description: 'Humor de 1 (péssimo) a 5 (ótimo)' },
        energy:      { type: 'integer', description: 'Energia de 1 (esgotado) a 5 (cheio de energia)' },
        hours_slept: { type: 'number',  description: 'Horas dormidas' },
        notes:       { type: 'string',  description: 'Observações opcionais sobre o dia' },
      },
      required: ['mood', 'energy', 'hours_slept'],
    },
  },
  {
    name: 'get_concurso_status',
    description: 'Dias até a prova do CBMSC e alertas de edital ainda não descartados. Use para "quanto falta pra prova?", "saiu edital?", ou quando o prazo for relevante pra decisão.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_weather',
    description: 'Previsão do tempo de hoje e amanhã, com chance de chuva hora a hora no resto do dia. Use quando Bernardo perguntar do tempo, ou quando ele for correr/treinar ao ar livre — o Cooper do TAF é na rua.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_planner_day',
    description: 'Retorna a rotina planejada (blocos de horário) de um dia da semana. Use para "como fica minha terça?" ou planejamento de outros dias.',
    input_schema: {
      type: 'object',
      properties: {
        day: { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], description: 'Dia da semana (padrão: hoje)' },
      },
    },
  },
  {
    name: 'create_planner_event',
    description: 'Adiciona uma sessão ao plano semanal do planner (estudo, revisão, treino, etc.). Use quando Bernardo quiser encaixar algo novo na semana.',
    input_schema: {
      type: 'object',
      properties: {
        day:              { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], description: 'Dia da semana' },
        start_time:       { type: 'string', description: 'Horário de início HH:MM' },
        topic:            { type: 'string', description: 'Assunto/título da sessão' },
        type:             { type: 'string', enum: ['study', 'review', 'train', 'rest', 'admin', 'other'], description: 'Tipo (padrão study)' },
        duration_minutes: { type: 'integer', description: 'Duração em minutos (padrão 60)' },
        priority:         { type: 'string', enum: ['high', 'medium', 'low'], description: 'Prioridade (padrão medium)' },
      },
      required: ['day', 'start_time', 'topic'],
    },
  },
  {
    name: 'delete_planner_event',
    description: 'Remove uma sessão do plano semanal. DESTRUTIVA: sempre chame primeiro com dry_run=true (padrão), mostre a Bernardo o que será removido, e só repita com dry_run=false depois que ele confirmar explicitamente. Com dry_run=false só executa se houver exatamente 1 sessão correspondente.',
    input_schema: {
      type: 'object',
      properties: {
        topic_contains: { type: 'string', description: 'Trecho do assunto/título da sessão' },
        day:            { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], description: 'Restringe a um dia (opcional)' },
        dry_run:        { type: 'boolean', description: 'true (padrão) = só mostra o que seria removido' },
      },
      required: ['topic_contains'],
    },
  },
];

export async function executePlannerTool(name, args) {
  switch (name) {
    case 'do_checkin': {
      const checkIns = kv('jarvis.checkIns') ?? {};
      checkIns[todayStr()] = {
        mood: args.mood,
        energy: args.energy,
        hoursSlept: args.hours_slept,
        notes: args.notes ?? '',
        recordedAt: new Date().toISOString(),
      };
      kvStore.set('jarvis.checkIns', JSON.stringify(checkIns));
      return { ok: true, message: 'Check-in registrado.', affectedKey: 'jarvis.checkIns' };
    }

    case 'get_concurso_status': {
      const examDate = kv('concurso.examDate');
      const today = todayStr();
      const dismissed = new Set(kv('concurso.dismissedEditalAlerts') ?? []);
      const alerts = (kv('concurso.editalAlertsCache')?.alerts ?? [])
        .filter((a) => !dismissed.has(a.url ?? a.title))
        .map((a) => ({ titulo: a.title, url: a.url, palavraChave: a.foundKeyword, detectadoEm: a.detectedAt }));
      return {
        ok: true,
        dataProva: examDate ?? null,
        diasAteProva: examDate ? daysBetween(today, examDate) : null,
        alertasDeEdital: alerts,
      };
    }

    case 'get_weather': {
      const weather = await getWeather();
      if (!weather) return { ok: false, message: 'Não consegui consultar a previsão agora.' };
      return { ok: true, ...weather };
    }

    case 'get_planner_day': {
      const ACTIVITY_LABELS = { free: 'Livre', study: 'Estudo', college: 'Faculdade', gym: 'Treino', work: 'Trabalho', meal: 'Refeição', commute: 'Deslocamento', rest: 'Descanso', personal: 'Pessoal' };
      const day = args.day ?? todayWeekDay();
      const routine = kv('planner.routine');
      const dayRoutine = routine?.days?.find((d) => d.day === day);
      if (!dayRoutine?.blocks?.length) return { ok: true, day, blocks: [], message: 'Nenhum bloco planejado para esse dia.' };
      const blocks = dayRoutine.blocks.map((b) => ({
        start: b.start, end: b.end, activity: ACTIVITY_LABELS[b.activity ?? 'free'] ?? 'Livre',
      }));
      return { ok: true, day, blocks };
    }

    case 'create_planner_event': {
      const plan = kv('planner.weeklyPlan');
      if (!plan?.weekOf) return { ok: false, error: 'Nenhum plano semanal ativo — crie o plano no app primeiro.' };
      plan.sessions = plan.sessions ?? [];
      plan.sessions.push({
        id: `jarvis-${Date.now()}`,
        day: args.day,
        startTime: args.start_time,
        type: args.type ?? 'study',
        topic: args.topic,
        durationMinutes: args.duration_minutes ?? 60,
        priority: args.priority ?? 'medium',
        reason: 'Adicionado pelo Jarvis',
      });
      kvStore.set('planner.weeklyPlan', JSON.stringify(plan));
      return { ok: true, message: `Sessão "${args.topic}" adicionada (${args.day} ${args.start_time}).`, affectedKey: 'planner.weeklyPlan' };
    }

    case 'delete_planner_event': {
      const plan = kv('planner.weeklyPlan');
      if (!plan?.sessions?.length) return { ok: false, error: 'Nenhum plano semanal ativo.' };
      const needle = args.topic_contains.toLowerCase();
      const matchIdxs = plan.sessions
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => s.topic?.toLowerCase().includes(needle) && (!args.day || s.day === args.day));
      const preview = matchIdxs.slice(0, 5).map(({ s, idx }) => ({ idx, day: s.day, startTime: s.startTime, topic: s.topic }));
      if (args.dry_run !== false) {
        return { ok: true, dryRun: true, matched: matchIdxs.length, preview, message: `${matchIdxs.length} sessão(ões) encontrada(s) — nada removido ainda. Confirme com Bernardo antes de executar.` };
      }
      if (matchIdxs.length !== 1) {
        return { ok: false, error: `Execução exige exatamente 1 correspondência, mas há ${matchIdxs.length}. Refine a busca.`, matched: matchIdxs.length, preview };
      }
      const removedIdx = matchIdxs[0].idx;
      const removed = plan.sessions[removedIdx];
      plan.sessions.splice(removedIdx, 1);
      kvStore.set('planner.weeklyPlan', JSON.stringify(plan));
      // Completions are keyed by "weekOf:index" — removing a session shifts every
      // index above it, so the keys must be remapped or progress gets misattributed.
      const completions = kv('study.sessionCompletions') ?? {};
      const remapped = {};
      for (const [key, status] of Object.entries(completions)) {
        const [weekOf, idxStr] = key.split(':');
        const idx = Number(idxStr);
        if (weekOf !== plan.weekOf || Number.isNaN(idx)) { remapped[key] = status; continue; }
        if (idx === removedIdx) continue; // completion of the deleted session dies with it
        remapped[`${weekOf}:${idx > removedIdx ? idx - 1 : idx}`] = status;
      }
      kvStore.set('study.sessionCompletions', JSON.stringify(remapped));
      return { ok: true, message: `Sessão "${removed.topic}" (${removed.day} ${removed.startTime}) removida.`, affectedKey: 'planner.weeklyPlan', extraAffectedKeys: ['study.sessionCompletions'] };
    }

    default:
      return undefined;
  }
}
