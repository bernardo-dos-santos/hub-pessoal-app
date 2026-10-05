/**
 * jarvis/tasks.js — tarefas compostas em background (Fase 4). Resolve o
 * timeout de 30s do cliente do chat: delegate_task devolve na hora e o
 * trabalho pesado (Sonnet, raciocínio estendido, até 20 iterações de tool
 * use) roda fora do request HTTP que o originou.
 */

import { kvStore } from '../db.js';
import { kv } from './context.js';
import { runAgent } from './agent.js';
import { PERSONA_PROMPT, STYLE_REMINDER } from './persona.js';
import { buildContext, buildContextPrompt } from './context.js';
import { getActionTools } from './tools/index.js';
import { sendPushNotifications } from '../push.js';
import { agentParamsFor, getJarvisConfig } from './config.js';
import { canStartAutonomousTask } from './budget.js';
import { addInboxItem } from './inbox.js';

const MAX_TASKS = 30;

function genId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadTasks() {
  return kv('jarvis.tasks') ?? [];
}

function saveTasks(tasks) {
  kvStore.set('jarvis.tasks', JSON.stringify(tasks.slice(0, MAX_TASKS)));
}

function patchTask(id, patch) {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;
  tasks[idx] = { ...tasks[idx], ...patch };
  saveTasks(tasks);
}

function notifyTaskDone(goal, text) {
  addInboxItem({
    kind: 'task_result',
    title: `Terminei: "${goal.length > 60 ? `${goal.slice(0, 60)}…` : goal}"`,
    body: text || null,
  });
  void sendPushNotifications([{ title: 'JARVIS terminou uma tarefa', body: (text || goal).slice(0, 150), url: '/' }]).catch(() => null);
}

async function runTask(taskId, goal) {
  const ctx = buildContext();
  const contextPrompt = buildContextPrompt(ctx);
  const systemBlocks = [
    { type: 'text', text: PERSONA_PROMPT },
    { type: 'text', text: contextPrompt },
    { type: 'text', text: STYLE_REMINDER },
  ];

  try {
    const result = await runAgent({
      ...agentParamsFor('task'),
      systemBlocks,
      messages: [{ role: 'user', content: goal }],
      tools: getActionTools(getJarvisConfig()),
    });
    patchTask(taskId, { status: 'done', finishedAt: new Date().toISOString(), result: result.text });
    notifyTaskDone(goal, result.text);
  } catch (err) {
    patchTask(taskId, { status: 'error', finishedAt: new Date().toISOString(), error: err.message });
    notifyTaskDone(goal, `Não consegui terminar: ${err.message}`);
  }
}

/**
 * Cria a tarefa, devolve o id NA HORA, e roda em background (fire-and-forget).
 *
 * Devolve `{ ok: false, reason }` quando a camada 2 da trava de gasto barra —
 * tarefa autônoma é a única coisa que o teto mensal pausa, justamente por ser
 * a que gasta mais sem você estar olhando.
 */
export function startJarvisTask(goal) {
  const gate = canStartAutonomousTask();
  if (!gate.allowed) return { ok: false, reason: gate.reason };

  const task = {
    id: genId(),
    goal,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
  };
  saveTasks([task, ...loadTasks()]);
  void runTask(task.id, goal);
  return { ok: true, taskId: task.id };
}

export function getJarvisTask(id) {
  return loadTasks().find((t) => t.id === id) ?? null;
}
