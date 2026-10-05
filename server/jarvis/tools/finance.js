/**
 * jarvis/tools/finance.js — add_finance_transaction, add_investment_contribution,
 * list_transactions, get_budget_status, delete_transaction.
 */

import { kvStore } from '../../db.js';
import { kv, todayStr, matchesCategory } from '../context.js';

export const financeTools = [
  {
    name: 'add_finance_transaction',
    description: 'Registra uma transação financeira (gasto, receita ou compra no cartão). Use quando Bernardo mencionar que gastou, recebeu ou comprou algo.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Descrição breve da transação' },
        amount:      { type: 'number', description: 'Valor em reais (sempre positivo)' },
        kind:        { type: 'string', enum: ['expense', 'income', 'card_purchase'], description: 'expense=débito/dinheiro, card_purchase=cartão de crédito, income=receita' },
        category:    { type: 'string', description: 'Categoria (alimentação, transporte, lazer, saúde, moradia, outros)' },
      },
      required: ['description', 'amount', 'kind'],
    },
  },
  {
    name: 'add_investment_contribution',
    description: 'Registra um aporte (dinheiro entrando) num investimento JÁ CADASTRADO na carteira. Use quando Bernardo mencionar que aportou, investiu ou mandou dinheiro pra uma corretora/ativo específico que já existe no Hub. NÃO cria investimento novo — se não achar correspondência clara, retorne o erro da ferramenta pra ele e sugira cadastrar pelo app primeiro.',
    input_schema: {
      type: 'object',
      properties: {
        investment_name: { type: 'string', description: 'Nome ou parte do nome do investimento ou da instituição (ex: "XP", "Tesouro IPCA", "Nubank")' },
        amount:           { type: 'number', description: 'Valor aportado em reais (sempre positivo)' },
        date:             { type: 'string', description: 'Data no formato YYYY-MM-DD (use hoje se não especificado)' },
      },
      required: ['investment_name', 'amount'],
    },
  },
  {
    name: 'list_transactions',
    description: 'Lista transações financeiras detalhadas de um mês. Use quando o contexto agregado (receita/gastos) não bastar — ex.: "quanto gastei com mercado?", "quais foram meus últimos gastos?".',
    input_schema: {
      type: 'object',
      properties: {
        month:    { type: 'string', description: 'Mês YYYY-MM (padrão: mês atual)' },
        category: { type: 'string', description: 'Filtra por categoria (opcional)' },
        limit:    { type: 'integer', description: 'Máximo de transações retornadas (padrão 15)' },
      },
    },
  },
  {
    name: 'get_budget_status',
    description: 'Retorna os orçamentos ativos com limite, quanto já foi gasto no período, quanto resta e o percentual usado. Use SEMPRE que Bernardo perguntar se pode gastar algo, ou como está um orçamento — o saldo do contexto não considera limite por categoria.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filtra por categoria (opcional)' },
      },
    },
  },
  {
    name: 'delete_transaction',
    description: 'Apaga uma transação financeira. DESTRUTIVA: sempre chame primeiro com dry_run=true (padrão), mostre a Bernardo exatamente o que será apagado, e só repita com dry_run=false depois que ele confirmar explicitamente. Com dry_run=false só executa se houver exatamente 1 transação correspondente.',
    input_schema: {
      type: 'object',
      properties: {
        description_contains: { type: 'string', description: 'Trecho da descrição da transação' },
        month:                { type: 'string', description: 'Mês YYYY-MM para restringir a busca (opcional)' },
        dry_run:              { type: 'boolean', description: 'true (padrão) = só mostra o que seria apagado' },
      },
      required: ['description_contains'],
    },
  },
];

export async function executeFinanceTool(name, args) {
  switch (name) {
    case 'add_finance_transaction': {
      const transactions = kv('finance.transactions') ?? [];
      const isExpense = args.kind === 'expense' || args.kind === 'card_purchase';
      const newTx = {
        id: `jarvis-${Date.now()}`,
        description: args.description,
        amount: isExpense ? -Math.abs(args.amount) : Math.abs(args.amount),
        kind: args.kind,
        category: args.category ?? 'outros',
        date: todayStr(),
        source: 'jarvis',
        needsReview: false,
      };
      transactions.unshift(newTx);
      kvStore.set('finance.transactions', JSON.stringify(transactions));
      return { ok: true, message: `Transação "${args.description}" de R$${args.amount.toFixed(2)} registrada.`, affectedKey: 'finance.transactions' };
    }

    case 'add_investment_contribution': {
      const investments = kv('finance.investments') ?? [];
      const needle = String(args.investment_name ?? '').trim().toLowerCase();
      if (!needle) return { ok: false, error: 'Nome do investimento vazio.' };

      let matches = investments.filter(
        (inv) => inv.name?.toLowerCase().includes(needle) || inv.institution?.toLowerCase().includes(needle),
      );
      if (matches.length > 1) {
        // Uma correspondência exata entre várias parciais desempata sem pedir pro
        // Bernardo repetir — ex.: "XP" bate parcial em duas contas, mas só uma
        // instituição chama exatamente "XP".
        const exact = matches.filter(
          (inv) => inv.name?.toLowerCase() === needle || inv.institution?.toLowerCase() === needle,
        );
        if (exact.length === 1) matches = exact;
      }
      if (matches.length === 0) {
        return { ok: false, error: `Nenhum investimento encontrado parecido com "${args.investment_name}". Cadastre primeiro pelo app.` };
      }
      if (matches.length > 1) {
        return { ok: false, error: `Mais de um investimento bate com "${args.investment_name}": ${matches.map((m) => m.name).join(', ')}. Seja mais específico.` };
      }

      const investment = matches[0];
      if ((investment.currency ?? 'BRL') !== 'BRL') {
        return { ok: false, error: `"${investment.name}" é em dólar — aporte em moeda estrangeira precisa do câmbio do dia, registre pelo app.` };
      }

      const date = args.date ?? todayStr();
      const movements = kv('finance.investments.movements') ?? [];
      movements.unshift({
        id: `jarvis-${Date.now()}`,
        investmentId: investment.id,
        type: 'contribution',
        date,
        amount: Math.abs(args.amount),
        note: 'Registrado via Jarvis',
        source: 'manual',
        createdAt: new Date().toISOString(),
      });
      kvStore.set('finance.investments.movements', JSON.stringify(movements));

      // Recalcula o cache do investimento a partir do histórico — mesma regra de
      // calculatePosition em investmentMovementService.ts. DUPLICADO aqui porque
      // o servidor é JS puro e não importa TS do frontend: se a regra de posição
      // mudar lá, replique aqui também.
      const ownMovements = movements
        .filter((m) => m.investmentId === investment.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
      let totalInvested = 0;
      let lastValuation = null;
      for (const m of ownMovements) {
        if (m.type === 'contribution') totalInvested += Math.abs(m.amount) * (m.exchangeRate ?? 1);
        else if (m.type === 'withdrawal') totalInvested -= Math.abs(m.amount) * (m.exchangeRate ?? 1);
        else lastValuation = m;
      }
      const currentValue = lastValuation ? Math.abs(lastValuation.amount) * (lastValuation.exchangeRate ?? 1) : totalInvested;

      const idx = investments.findIndex((i) => i.id === investment.id);
      investments[idx] = { ...investment, totalInvested, currentValue, updatedAt: new Date().toISOString() };
      kvStore.set('finance.investments', JSON.stringify(investments));

      return {
        ok: true,
        message: `Aporte de R$${args.amount.toFixed(2)} registrado em "${investment.name}".`,
        affectedKey: 'finance.investments',
        extraAffectedKeys: ['finance.investments.movements'],
      };
    }

    case 'list_transactions': {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      let txs = (kv('finance.transactions') ?? []).filter((t) => t.date?.startsWith(month));
      if (args.category) {
        const cat = args.category.toLowerCase();
        txs = txs.filter((t) => (t.category ?? '').toLowerCase().includes(cat));
      }
      const total = txs.reduce((s, t) => s + (t.amount ?? 0), 0);
      const list = txs.slice(0, args.limit ?? 15).map((t) => ({
        date: t.date, description: t.description, amount: t.amount, kind: t.kind, category: t.category,
      }));
      return { ok: true, month, matched: txs.length, totalAmount: Number(total.toFixed(2)), transactions: list };
    }

    case 'get_budget_status': {
      const budgets = (kv('finance.budgets') ?? []).filter((b) => b.isActive !== false);
      if (budgets.length === 0) return { ok: true, budgets: [], message: 'Nenhum orçamento ativo cadastrado.' };

      const month = todayStr().slice(0, 7);
      const monthTxs = (kv('finance.transactions') ?? [])
        .filter((t) => t.date?.startsWith(month) && t.kind !== 'income');

      const result = budgets
        .filter((b) => !args.category || matchesCategory(b, args.category))
        .map((b) => {
          // Um orçamento pode cobrir várias categorias (campo `categories`) ou uma só.
          const cats = (b.categories?.length ? b.categories : [b.category])
            .filter(Boolean)
            .map((c) => c.toLowerCase());
          const spent = monthTxs
            .filter((t) => cats.includes((t.category ?? '').toLowerCase()))
            .reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0);
          const limit = b.limit ?? b.amount ?? 0;
          return {
            name: b.name,
            categories: cats,
            limit,
            spent: Number(spent.toFixed(2)),
            remaining: Number((limit - spent).toFixed(2)),
            percentUsed: limit > 0 ? Math.round((spent / limit) * 100) : null,
            exceeded: limit > 0 && spent > limit,
          };
        });

      return { ok: true, month, budgets: result };
    }

    case 'delete_transaction': {
      const transactions = kv('finance.transactions') ?? [];
      const needle = args.description_contains.toLowerCase();
      const matches = transactions.filter((t) =>
        (t.description ?? '').toLowerCase().includes(needle)
        && (!args.month || t.date?.startsWith(args.month)),
      );
      const preview = matches.slice(0, 5).map((t) => ({ date: t.date, description: t.description, amount: t.amount }));
      if (args.dry_run !== false) {
        return { ok: true, dryRun: true, matched: matches.length, preview, message: `${matches.length} transação(ões) encontrada(s) — nada apagado ainda. Confirme com Bernardo antes de executar.` };
      }
      if (matches.length !== 1) {
        return { ok: false, error: `Execução exige exatamente 1 correspondência, mas há ${matches.length}. Refine a busca.`, matched: matches.length, preview };
      }
      kvStore.set('finance.transactions', JSON.stringify(transactions.filter((t) => t.id !== matches[0].id)));
      return { ok: true, message: `Transação "${matches[0].description}" (${matches[0].date}, R$${Math.abs(matches[0].amount ?? 0).toFixed(2)}) apagada.`, affectedKey: 'finance.transactions' };
    }

    default:
      return undefined;
  }
}
