/**
 * jarvis/tools/memory.js — memória de longo prazo, metas e log de auditoria.
 *
 * A memória de fatos NÃO mora mais aqui: `remember_fact`/`forget_fact` foram
 * substituídos pela memory tool nativa da Anthropic (`memory_20250818`), cujo
 * backend em disco está em ../memoryStore.js. Este arquivo só faz a ponte —
 * declara a tool e despacha os comandos dela.
 */

import { kvStore } from '../../db.js';
import { kv } from '../context.js';
import { runMemoryCommand, READ_ONLY_MEMORY_COMMANDS } from '../memoryStore.js';

/**
 * A memory tool é definida pela Anthropic: `type` + `name`, sem input_schema.
 * Não passa por `partitionByCore` nem ganha `defer_loading` — diferir a memória
 * seria esconder justamente a ferramenta que o protocolo injetado pela API
 * manda o modelo usar ANTES de qualquer coisa.
 */
export const memoryFileTool = { type: 'memory_20250818', name: 'memory' };

/** A memória de longo prazo é um dial: preset Básico roda sem ela, de propósito. */
export function memoryToolEnabled(config) {
  return config?.capabilities?.memoryTool === true;
}

export const memoryTools = [
  {
    name: 'update_goal_progress',
    description: 'Atualiza o percentual de progresso de uma meta ativa. Meta com 100% é automaticamente marcada como concluída.',
    input_schema: {
      type: 'object',
      properties: {
        goal_title: { type: 'string', description: 'Título ou parte do título da meta a atualizar' },
        progress:   { type: 'number', description: 'Novo progresso de 0 a 100' },
      },
      required: ['goal_title', 'progress'],
    },
  },
  {
    name: 'list_goals',
    description: 'Lista todas as metas com título, progresso e status. O contexto só mostra as 5 ativas primeiras — use para ver tudo, incluindo concluídas.',
    input_schema: {
      type: 'object',
      properties: {
        include_completed: { type: 'boolean', description: 'Incluir metas concluídas (padrão false)' },
      },
    },
  },
  {
    name: 'get_audit_log',
    description: 'Retorna o registro das últimas ações de escrita que VOCÊ executou no Hub (tool, argumentos, resultado, data). Use quando Bernardo perguntar o que você andou registrando/alterando.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Quantas entradas retornar (padrão 15)' },
      },
    },
  },
];

export async function executeMemoryTool(name, args) {
  // A memory tool devolve TEXTO, não JSON: `_text` é a convenção que faz o
  // agent.js mandar a string crua como conteúdo do tool_result (ver lá).
  if (name === 'memory') {
    const { ok, text } = runMemoryCommand(args);
    return {
      ok,
      _text: text,
      readOnly: READ_ONLY_MEMORY_COMMANDS.has(args?.command),
      affectedKey: undefined,
    };
  }

  switch (name) {
    case 'update_goal_progress': {
      const goals = kv('goals.list') ?? [];
      const idx = goals.findIndex(
        (g) => g.status === 'active' && g.title.toLowerCase().includes(args.goal_title.toLowerCase()),
      );
      if (idx < 0) return { ok: false, error: `Meta "${args.goal_title}" não encontrada entre as metas ativas.` };
      goals[idx].progress = Math.max(0, Math.min(100, args.progress));
      if (goals[idx].progress === 100) goals[idx].status = 'completed';
      kvStore.set('goals.list', JSON.stringify(goals));
      return { ok: true, message: `Meta "${goals[idx].title}" atualizada para ${goals[idx].progress}%.`, affectedKey: 'goals.list' };
    }

    case 'list_goals': {
      const goals = (kv('goals.list') ?? [])
        .filter((g) => args.include_completed || g.status === 'active')
        .map((g) => ({ title: g.title, progress: g.progress ?? 0, status: g.status }));
      return { ok: true, goals };
    }

    case 'get_audit_log': {
      const entries = (kv('jarvis.auditLog') ?? []).slice(0, args.limit ?? 15)
        // Local time — the model reads raw UTC ISO strings as if they were local.
        .map((e) => ({ when: new Date(e.timestamp).toLocaleString('pt-BR'), tool: e.tool, result: e.result }));
      return { ok: true, entries };
    }

    default:
      return undefined;
  }
}
