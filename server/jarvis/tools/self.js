/**
 * jarvis/tools/self.js — ferramentas que só o TICK PROATIVO (Fase 2) usa, não
 * o chat. Escrevem em jarvis.inbox / jarvis.tracked (mesmas chaves que o
 * frontend lê via jarvisInbox.ts / jarvisTracked.ts — mesmo formato de item,
 * duplicado aqui pela mesma razão de sempre: servidor é JS puro, não importa
 * TS do frontend).
 */

import { kvStore } from '../../db.js';
import { kv } from '../context.js';
import { sendPushNotifications } from '../../push.js';
import { addInboxItem } from '../inbox.js';

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const selfTools = [
  {
    name: 'notify_bernardo',
    description: 'Interrompe Bernardo AGORA com uma notificação push, e registra o mesmo texto na caixa de entrada do Jarvis. Use só quando a informação precisa chegar até ele já — não pra qualquer observação. Ele vai ler no celular ou no notebook.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto da notificação (com emoji quando fizer sentido)' },
        body:  { type: 'string', description: 'Corpo da notificação — uma observação específica, com número real' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'add_inbox_note',
    description: 'Registra uma observação ou pergunta na caixa de entrada do Jarvis SEM interromper Bernardo com push. Use pra algo que pode esperar até ele abrir o app por conta própria.',
    input_schema: {
      type: 'object',
      properties: {
        kind:  { type: 'string', enum: ['observation', 'question'], description: 'observation=reparo seu, question=algo que você quer perguntar a ele' },
        title: { type: 'string', description: 'Título curto' },
        body:  { type: 'string', description: 'Detalhe opcional' },
      },
      required: ['kind', 'title'],
    },
  },
  {
    name: 'track',
    description: 'Passa a acompanhar algo — você vai voltar a olhar isso num tick futuro, depois de check_after. Use quando algo merece atenção mas ainda não justifica interromper Bernardo.',
    input_schema: {
      type: 'object',
      properties: {
        what:        { type: 'string', description: 'O que está acompanhando, curto e autocontido' },
        why:         { type: 'string', description: 'Por que vale acompanhar' },
        check_after: { type: 'string', description: 'Data/hora ISO a partir de quando voltar a olhar (ex: amanhã de manhã)' },
      },
      required: ['what', 'why', 'check_after'],
    },
  },
  {
    name: 'untrack',
    description: 'Encerra um acompanhamento — use quando o que estava sendo observado deixou de ser relevante ou já foi resolvido.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id do item retornado por list_tracked' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tracked',
    description: 'Lista o que você está acompanhando no momento (ativos), com o que é, por quê, e quando volta a olhar.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'stay_silent',
    description: 'Encerra o tick sem falar com Bernardo, registrando o motivo pra auditoria. É o resultado esperado na maioria dos ticks — use sempre que nada justificar notify_bernardo, add_inbox_note ou track.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Por que decidiu não falar' },
      },
      required: ['reason'],
    },
  },
];

export async function executeSelfTool(name, args) {
  switch (name) {
    case 'notify_bernardo': {
      const item = addInboxItem({ kind: 'observation', title: args.title, body: args.body });
      await sendPushNotifications([{ title: args.title, body: args.body, url: '/' }]).catch(() => null);
      return { ok: true, message: `Notificado: "${args.title}"`, affectedKey: 'jarvis.inbox', inboxItemId: item.id };
    }

    case 'add_inbox_note': {
      const item = addInboxItem({ kind: args.kind, title: args.title, body: args.body });
      return { ok: true, message: `Anotado na inbox: "${args.title}"`, affectedKey: 'jarvis.inbox', inboxItemId: item.id };
    }

    case 'track': {
      const tracked = kv('jarvis.tracked') ?? [];
      const item = {
        id: genId('tracked'),
        what: args.what,
        why: args.why,
        createdAt: new Date().toISOString(),
        checkAfter: args.check_after,
        status: 'active',
      };
      kvStore.set('jarvis.tracked', JSON.stringify([item, ...tracked]));
      return { ok: true, message: `Acompanhando: "${args.what}"`, affectedKey: 'jarvis.tracked' };
    }

    case 'untrack': {
      const tracked = kv('jarvis.tracked') ?? [];
      const idx = tracked.findIndex((t) => t.id === args.id);
      if (idx === -1) return { ok: false, error: `Nenhum acompanhamento com id "${args.id}".` };
      tracked[idx] = { ...tracked[idx], status: 'done' };
      kvStore.set('jarvis.tracked', JSON.stringify(tracked));
      return { ok: true, message: `Acompanhamento encerrado: "${tracked[idx].what}"`, affectedKey: 'jarvis.tracked' };
    }

    case 'list_tracked': {
      const tracked = (kv('jarvis.tracked') ?? []).filter((t) => t.status === 'active');
      return { ok: true, tracked };
    }

    case 'stay_silent': {
      // Não escreve na inbox — o log de decisão fica em jarvis.initiative.log,
      // gravado por quem chama o tick (initiative.js), não aqui.
      return { ok: true, silent: true, reason: args.reason, message: null };
    }

    default:
      return undefined;
  }
}
