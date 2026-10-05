/**
 * jarvis/tools/actions.js — ferramentas que EXECUTAM uma tarefa de verdade
 * (Fase 5), em vez de só ler/escrever um registro. Reusam o que o resto do
 * servidor já sabe fazer — nada de lógica nova de geração aqui.
 *
 * `run_sync` (SIGAA/Pluggy) tinha ficado de fora: Puppeteer de vários minutos
 * é longo demais para o turno do chat e arriscado demais para uma tool call
 * disparar sozinha. Voltou na Fase 11 porque as duas objeções caíram — passa
 * pela fila de aprovação e roda solto (ver ../syncRunner.js), então não bloqueia
 * ninguém e não acontece sem o Bernardo mandar. Continua fora do tick.
 */

import { kvStore } from '../../db.js';
import { kv } from '../context.js';
import { generateBriefing } from '../../briefing.js';
import { generateAndSaveWeeklyPlan } from '../../ai-planner.js';
import { generateMonthlySummary } from '../../finance-monthly-summary.js';
import { requestApproval } from '../commands.js';
import { SYNCS, isSyncRunning } from '../syncRunner.js';

export const actionTools = [
  {
    name: 'generate_briefing',
    description: 'Gera (ou regenera) o briefing do dia — o resumo que aparece na Home. Use quando Bernardo pedir um resumo do dia ou quando uma tarefa delegada precisar dele atualizado.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_weekly_plan',
    description: 'Gera um novo plano semanal de estudos via IA, substituindo o atual. Use quando Bernardo pedir pra organizar/replanejar a semana.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_monthly_finance_summary',
    description: 'Gera o resumo financeiro de um mês (receita, gastos, saldo, diagnóstico). Use quando Bernardo pedir um fechamento financeiro de um mês específico.',
    input_schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Mês YYYY-MM (padrão: mês anterior ao atual)' },
      },
    },
  },
  {
    name: 'recategorize_transactions',
    description: 'Muda a categoria de várias transações financeiras de uma vez. DESTRUTIVA por escala (afeta N transações): sempre chame primeiro com dry_run=true (padrão), mostre a Bernardo quantas e quais seriam afetadas, e só repita com dry_run=false depois que ele confirmar explicitamente.',
    input_schema: {
      type: 'object',
      properties: {
        description_contains: { type: 'string', description: 'Trecho da descrição pra filtrar as transações' },
        current_category:     { type: 'string', description: 'Restringe às transações que já têm esta categoria (opcional)' },
        month:                { type: 'string', description: 'Mês YYYY-MM pra restringir a busca (opcional)' },
        new_category:         { type: 'string', description: 'Categoria nova a aplicar' },
        dry_run:              { type: 'boolean', description: 'true (padrão) = só mostra o que seria alterado' },
      },
      required: ['description_contains', 'new_category'],
    },
  },
  {
    name: 'reschedule_session',
    description: 'Move uma sessão do plano semanal pra outro dia/horário, sem apagar nem recriar — as marcações de conclusão da sessão continuam valendo. Use o índice global mostrado no contexto ou em get_study_plan.',
    input_schema: {
      type: 'object',
      properties: {
        session_index: { type: 'integer', description: 'Índice global da sessão no plano semanal' },
        to_day:        { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], description: 'Novo dia (omita pra manter o atual)' },
        to_time:       { type: 'string', description: 'Novo horário HH:MM (omita pra manter o atual)' },
      },
      required: ['session_index'],
    },
  },
  {
    name: 'run_sync',
    description: 'Dispara um sync sob demanda: "sigaa" traz notas, tarefas e materiais da faculdade; "pluggy" traz transações e investimentos do banco. Vai para a fila de aprovação e depois roda por vários minutos em background — o resultado chega na caixa de entrada, não na sua resposta. Diga que pediu e siga; não fique esperando.',
    input_schema: {
      type: 'object',
      properties: {
        which: { type: 'string', enum: ['sigaa', 'pluggy'], description: 'Qual sync rodar' },
        why: { type: 'string', description: 'Por que agora — aparece para o Bernardo na hora de aprovar' },
      },
      required: ['which', 'why'],
    },
  },
];

export async function executeActionTool(name, args) {
  switch (name) {
    case 'generate_briefing': {
      const briefing = await generateBriefing(true);
      return { ok: true, message: briefing.text, affectedKey: 'hub.briefing' };
    }

    case 'generate_weekly_plan': {
      const result = await generateAndSaveWeeklyPlan();
      return { ok: true, message: `Plano novo gerado: ${result.sessions} sessões para a semana de ${result.weekOf}.`, affectedKey: 'planner.weeklyPlan' };
    }

    case 'generate_monthly_finance_summary': {
      const summary = await generateMonthlySummary(args.month ?? null);
      return {
        ok: true,
        message: `${summary.diagnosis} (receita R$${summary.income.toFixed(0)}, gastos R$${summary.totalOutflow.toFixed(0)}, saldo R$${summary.balance.toFixed(0)})`,
        affectedKey: `finance.monthly-summary.${args.month ?? summary.month}`,
      };
    }

    case 'recategorize_transactions': {
      const transactions = kv('finance.transactions') ?? [];
      const needle = args.description_contains.toLowerCase();
      const matches = transactions.filter((t) =>
        (t.description ?? '').toLowerCase().includes(needle)
        && (!args.current_category || t.category === args.current_category)
        && (!args.month || t.date?.startsWith(args.month)),
      );
      const preview = matches.slice(0, 8).map((t) => ({ date: t.date, description: t.description, category: t.category }));
      if (args.dry_run !== false) {
        return { ok: true, dryRun: true, matched: matches.length, preview, message: `${matches.length} transação(ões) mudariam para "${args.new_category}" — nada alterado ainda. Confirme com Bernardo antes de executar.` };
      }
      if (matches.length === 0) {
        return { ok: false, error: 'Nenhuma transação corresponde ao filtro.' };
      }
      const matchedIds = new Set(matches.map((t) => t.id));
      const updated = transactions.map((t) => (matchedIds.has(t.id) ? { ...t, category: args.new_category } : t));
      kvStore.set('finance.transactions', JSON.stringify(updated));
      return { ok: true, message: `${matches.length} transação(ões) recategorizada(s) para "${args.new_category}".`, affectedKey: 'finance.transactions' };
    }

    case 'reschedule_session': {
      const plan = kv('planner.weeklyPlan');
      if (!plan?.sessions?.length) return { ok: false, error: 'Nenhum plano semanal ativo.' };
      const session = plan.sessions[args.session_index];
      if (!session) return { ok: false, error: `Nenhuma sessão no índice ${args.session_index}.` };
      const before = { day: session.day, startTime: session.startTime };
      if (args.to_day) session.day = args.to_day;
      if (args.to_time) session.startTime = args.to_time;
      kvStore.set('planner.weeklyPlan', JSON.stringify(plan));
      return {
        ok: true,
        message: `Sessão "${session.topic}" movida de ${before.day} ${before.startTime} para ${session.day} ${session.startTime}.`,
        affectedKey: 'planner.weeklyPlan',
      };
    }

    case 'run_sync': {
      const sync = SYNCS[args.which];
      if (!sync) return { ok: false, error: `Sync desconhecido: "${args.which}".` };
      // Barrar aqui poupa uma aprovação inútil: aprovar um sync que já está
      // rodando só produziria um erro do outro lado do clique.
      if (isSyncRunning(args.which)) return { ok: false, error: `O sync do ${sync.label} já está rodando agora.` };

      return requestApproval({
        kind: 'sync',
        display: `DISPARAR SYNC\nQual: ${sync.label}\n\n${sync.hint}`,
        why: args.why,
        payload: { which: args.which },
      });
    }

    default:
      return undefined;
  }
}
