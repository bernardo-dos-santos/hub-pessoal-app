/**
 * jarvis/audit.js — registro do que o Jarvis alterou.
 *
 * Vive em módulo próprio, e não dentro de tools/index.js, para quebrar um
 * ciclo de importação real: commands.js precisa auditar, index.js importa
 * machineTools de machine.js no topo, e machine.js importa commands.js. Com o
 * log dentro do index, esse ciclo passava a depender da ORDEM em que os
 * módulos fossem carregados primeiro — funcionava por um caminho e estourava
 * "Cannot access 'machineTools' before initialization" por outro.
 *
 * (O ciclo antigo — machine/fitness/memory importando de volta do index — é
 * seguro por outro motivo: aqueles só leem o valor dentro do corpo de uma
 * função, nunca na avaliação do módulo.)
 */

import { kvStore } from '../db.js';
import { kv } from './context.js';

export const MAX_AUDIT_ENTRIES = 200;

/** Registra uma escrita bem-sucedida. Consultável pela tool get_audit_log. */
export function logAudit(tool, args, result) {
  const entries = kv('jarvis.auditLog') ?? [];
  entries.unshift({
    timestamp: new Date().toISOString(),
    tool,
    args,
    result: result.message ?? null,
  });
  kvStore.set('jarvis.auditLog', JSON.stringify(entries.slice(0, MAX_AUDIT_ENTRIES)));
}
