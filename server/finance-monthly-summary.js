/**
 * finance-monthly-summary.js — gera o resumo financeiro mensal via IA (Gemini).
 * Salva em: finance.monthly-summary.YYYY-MM
 * Chamado pelo script schedule/generate-monthly-finance-summary.js, dia 06 às 00:30.
 */

import { kvStore } from './db.js';
import { callAi } from './aiProvider.js';

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function kv(key) {
  const raw = kvStore.get(key);
  return raw ? safeJson(raw) : null;
}

function fmtBRL(n) {
  return `R$${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function previousMonthStr() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const NEUTRAL_KINDS = new Set(['transfer', 'card_payment', 'card_payment_received', 'refund', 'review']);

function computeMonthMetrics(yyyyMM, transactions) {
  const monthTxs = transactions.filter((t) => t.date?.startsWith(yyyyMM));

  const income = monthTxs
    .filter((t) => t.kind === 'income')
    .reduce((s, t) => s + (t.amount ?? 0), 0);

  const expenses = monthTxs
    .filter((t) => t.kind === 'expense')
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const cardPurchases = monthTxs
    .filter((t) => t.kind === 'card_purchase')
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  const cardPayments = monthTxs
    .filter((t) => t.kind === 'card_payment')
    .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);

  // two-pool model: balance = income − expenses(cash) − card_payments
  // cardPurchases tracked separately as credit pool usage
  const totalOutflow = expenses + cardPayments;
  const balance = income - totalOutflow;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  const categoryTotals = {};
  for (const tx of monthTxs) {
    if (!NEUTRAL_KINDS.has(tx.kind) && tx.kind !== 'income' && tx.amount) {
      const cat = tx.category ?? 'outros';
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + Math.abs(tx.amount);
    }
  }
  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cat, total]) => ({ cat, total }));

  return { income, expenses, cardPurchases, cardPayments, totalOutflow, balance, savingsRate, topCategories, txCount: monthTxs.length };
}

export async function generateMonthlySummary(yyyyMM) {
  const targetMonth = yyyyMM ?? previousMonthStr();

  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error('Formato de mês inválido. Use YYYY-MM.');
  }

  const transactions = kv('finance.transactions') ?? [];
  const budgets = kv('finance.budgets') ?? [];

  const current = computeMonthMetrics(targetMonth, transactions);

  // Até 3 meses anteriores para comparação
  const prevMonths = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(`${targetMonth}-01T12:00:00`);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const metrics = computeMonthMetrics(m, transactions);
    if (metrics.txCount > 0) prevMonths.push({ month: m, ...metrics });
  }

  const avgIncome = prevMonths.length > 0
    ? prevMonths.reduce((s, m) => s + m.income, 0) / prevMonths.length
    : null;
  const avgExpenses = prevMonths.length > 0
    ? prevMonths.reduce((s, m) => s + m.totalOutflow, 0) / prevMonths.length
    : null;

  const budgetStatuses = budgets
    .filter((b) => b.isActive !== false)
    .map((b) => {
      const spent = transactions
        .filter((t) =>
          t.date?.startsWith(targetMonth) &&
          t.category === b.category &&
          ['expense', 'card_purchase'].includes(t.kind),
        )
        .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0);
      return { name: b.name, category: b.category, limit: b.amount, spent, exceeded: spent > b.amount };
    });

  const [year, mon] = targetMonth.split('-');
  const monthLabel = new Date(`${year}-${mon}-15`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const categoriesText = current.topCategories.length > 0
    ? current.topCategories.map(({ cat, total }) => `  • ${cat}: ${fmtBRL(total)}`).join('\n')
    : '  Sem dados de categorias';

  const budgetsText = budgetStatuses.length > 0
    ? budgetStatuses.map((b) => `  • ${b.name}: gasto ${fmtBRL(b.spent)} de ${fmtBRL(b.limit)}${b.exceeded ? ' — EXCEDIDO' : ''}`).join('\n')
    : '  Nenhum orçamento configurado';

  const comparisonText = avgIncome !== null
    ? `Comparado à média dos ${prevMonths.length} meses anteriores: receita média ${fmtBRL(avgIncome)}, gastos médios ${fmtBRL(avgExpenses ?? 0)}.`
    : 'Sem histórico suficiente para comparação.';

  const prompt = `Você é o JARVIS, assistente financeiro pessoal do Bernardo. Analise o mês de ${monthLabel} e gere um diagnóstico financeiro.

DADOS DE ${monthLabel.toUpperCase()}:
Receita: ${fmtBRL(current.income)}
Gastos caixa: ${fmtBRL(current.totalOutflow)} (débito/PIX: ${fmtBRL(current.expenses)}, pgto. fatura: ${fmtBRL(current.cardPayments)})
Compras no crédito (pool separado, não deduz saldo): ${fmtBRL(current.cardPurchases)}
Saldo: ${fmtBRL(current.balance)} (${current.balance >= 0 ? 'positivo' : 'negativo'})
Taxa de poupança: ${current.savingsRate.toFixed(1)}%
${comparisonText}

TOP CATEGORIAS:
${categoriesText}

ORÇAMENTOS:
${budgetsText}

Responda em JSON com EXATAMENTE este formato (sem texto fora do JSON, sem markdown):
{
  "diagnosis": "Diagnóstico em 3-4 frases diretas com números reais. Tom analítico, sem eufemismos. Aponte o que foi bem e o que foi problemático.",
  "highlights": ["Ponto importante 1", "Ponto importante 2", "Ponto importante 3"],
  "recommendations": ["Ação concreta para o próximo mês 1", "Ação 2", "Ação 3"]
}`;

  const raw = await callAi(prompt, { temperature: 0.4 });

  let aiResult = null;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) aiResult = JSON.parse(match[0]);
  } catch {
    // diagnóstico indisponível
  }

  const summary = {
    month: targetMonth,
    generatedAt: new Date().toISOString(),
    income: current.income,
    expenses: current.expenses,
    cardPurchases: current.cardPurchases,
    cardPayments: current.cardPayments,
    totalOutflow: current.totalOutflow,
    balance: current.balance,
    savingsRate: current.savingsRate,
    topCategories: current.topCategories,
    budgetStatuses,
    comparison: avgIncome !== null
      ? { avgIncome, avgExpenses, monthsCompared: prevMonths.length }
      : null,
    diagnosis: aiResult?.diagnosis ?? 'Diagnóstico não disponível.',
    highlights: Array.isArray(aiResult?.highlights) ? aiResult.highlights : [],
    recommendations: Array.isArray(aiResult?.recommendations) ? aiResult.recommendations : [],
  };

  kvStore.set(`finance.monthly-summary.${targetMonth}`, JSON.stringify(summary));
  return summary;
}

export function getMonthlySummary(yyyyMM) {
  const raw = kvStore.get(`finance.monthly-summary.${yyyyMM}`);
  return raw ? safeJson(raw) : null;
}
