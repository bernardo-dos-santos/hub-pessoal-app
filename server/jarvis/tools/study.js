/**
 * jarvis/tools/study.js — mark_study_session_done, get_study_plan,
 * list_error_notebook, create_flashcard.
 */

import { kvStore } from '../../db.js';
import { kv } from '../context.js';

export const studyTools = [
  {
    name: 'mark_study_session_done',
    description: 'Marca uma sessão de estudo do plano semanal como concluída ou parcial. Use o índice global da sessão mostrado no contexto.',
    input_schema: {
      type: 'object',
      properties: {
        session_index: { type: 'integer', description: 'Índice global da sessão no plano (mostrado entre colchetes no contexto)' },
        status:        { type: 'string', enum: ['done', 'partial'], description: 'done=concluída, partial=parcialmente feita' },
      },
      required: ['session_index', 'status'],
    },
  },
  {
    name: 'get_study_plan',
    description: 'Retorna o plano de estudo semanal completo com o status de cada sessão (concluída/parcial/pendente). Use para perguntas sobre a semana além do dia de hoje.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_error_notebook',
    description: 'Questões que Bernardo errou e ainda não dominou, agrupadas por matéria. Use quando ele perguntar o que revisar, onde está errando mais, ou for montar sessão de estudo.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Máximo de entradas (padrão 20)' },
      },
    },
  },
  {
    name: 'create_flashcard',
    description: 'Cria um flashcard de estudo (frente/verso) num deck. Se o deck não existir, é criado. Use quando Bernardo pedir para criar um card ou quiser memorizar algo específico.',
    input_schema: {
      type: 'object',
      properties: {
        deck_name: { type: 'string', description: 'Nome do deck (busca por parte do nome; cria se não existir)' },
        front:     { type: 'string', description: 'Frente do card (pergunta/conceito)' },
        back:      { type: 'string', description: 'Verso do card (resposta/definição)' },
      },
      required: ['deck_name', 'front', 'back'],
    },
  },
];

export async function executeStudyTool(name, args) {
  switch (name) {
    case 'mark_study_session_done': {
      const plan = kv('planner.weeklyPlan');
      if (!plan?.weekOf) return { ok: false, error: 'Plano semanal não encontrado.' };
      const session = plan.sessions?.[args.session_index];
      if (!session) return { ok: false, error: `Sessão de índice ${args.session_index} não existe no plano.` };
      const completions = kv('study.sessionCompletions') ?? {};
      completions[`${plan.weekOf}:${args.session_index}`] = args.status;
      kvStore.set('study.sessionCompletions', JSON.stringify(completions));
      return { ok: true, message: `Sessão "${session.topic}" marcada como ${args.status === 'done' ? 'concluída' : 'parcial'}.`, affectedKey: 'study.sessionCompletions' };
    }

    case 'get_study_plan': {
      const plan = kv('planner.weeklyPlan');
      if (!plan?.sessions?.length) return { ok: false, error: 'Nenhum plano semanal encontrado.' };
      const completions = kv('study.sessionCompletions') ?? {};
      const sessions = plan.sessions.map((s, idx) => ({
        idx, day: s.day, startTime: s.startTime, topic: s.topic,
        status: completions[`${plan.weekOf}:${idx}`] ?? 'pendente',
      }));
      return { ok: true, weekOf: plan.weekOf, sessions };
    }

    case 'list_error_notebook': {
      const entries = (kv('study.errorNotebook') ?? []).filter((e) => e.status !== 'mastered');
      const porMateria = {};
      for (const e of entries) {
        const tag = e.subjectTag || 'sem matéria';
        porMateria[tag] = (porMateria[tag] ?? 0) + 1;
      }
      return {
        ok: true,
        total: entries.length,
        porMateria,
        // Mais falhas primeiro: é onde a revisão rende mais.
        entradas: entries
          .sort((a, b) => (b.timesFailed ?? 0) - (a.timesFailed ?? 0))
          .slice(0, args.limit ?? 20)
          .map((e) => ({
            materia: e.subjectTag,
            vezesQueErrou: e.timesFailed,
            motivo: e.reason === 'unknown' ? 'não sabia' : 'errou',
            status: e.status,
            errouPrimeiroEm: e.firstFailedAt?.slice(0, 10) ?? null,
          })),
      };
    }

    case 'create_flashcard': {
      const decks = kv('study.decks') ?? [];
      const needle = args.deck_name.toLowerCase();
      let deck = decks.find((d) => d.name?.toLowerCase().includes(needle));
      if (!deck) {
        deck = { id: `jarvis-${Date.now()}`, name: args.deck_name, subjectTag: args.deck_name, createdAt: new Date().toISOString() };
        kvStore.set('study.decks', JSON.stringify([deck, ...decks]));
      }
      const now = new Date().toISOString();
      const cards = kv('study.flashcards') ?? [];
      // FSRS initial fields — must mirror defaultFSRS() in spacedRepetitionService.ts
      cards.push({
        id: `jarvis-${Date.now()}`,
        deckId: deck.id,
        front: args.front.trim(),
        back: args.back.trim(),
        stability: 0, difficulty: 5, repetitionCount: 0, nextReviewAt: now, lastReviewedAt: now,
        createdAt: now,
      });
      kvStore.set('study.flashcards', JSON.stringify(cards));
      return { ok: true, message: `Flashcard criado no deck "${deck.name}".`, affectedKey: 'study.flashcards' };
    }

    default:
      return undefined;
  }
}
