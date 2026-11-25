/**
 * finance-monthly-summary.js — gera o resumo financeiro mensal via IA (Gemini).
 * Salva em: finance.monthly-summary.YYYY-MM
 * Chamado pelo script schedule/generate-monthly-finance-summary.js, dia 06 às 00:30.
 */

import { kvStore } from './db.js';
import { callAi } from './aiProvider.js';
import {
  clampStartDay,
  currentFinancialMonth,
  isInFinancialMonth,
  MONTH_START_DAY_KEY,
} from '../src/shared/finance/financeMonth.js';
import {
  budgetCategoryOf,
  budgetLimitOf,
  budgetSpent,
  netExpensesByCategory,
  summarizeTotals,
} from '../src/shared/finance/financeTotals.js';

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

/** The user's financial month start day (financeMonth.js). */
function monthStartDay() {
  return clampStartDay(kv(MONTH_START_DAY_KEY));
}

function shiftMonth(yyyyMM, delta) {
  const [year, month] = yyyyMM.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The financial month before the current one — always closed by the time it's summarized. */
export function previousMonthStr() {
  return shiftMonth(currentFinancialMonth(monthStartDay()), -1);
}

function computeMonthMetrics(yyyyMM, transactions, startDay) {
  const monthTxs = transactions.filter((t) => isInFinancialMonth(t.date, yyyyMM, startDay));

  // Same rule as the app (financeTotals.js): spending is everything consumed,
  // the card on the purchase date, minus refunds; bill payments, transfers and
  // investments are neutral.
  const { income, expenses, cardPurchases, balance } = summarizeTotals(monthTxs);
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  const topCategories = netExpensesByCategory(monthTxs)
    .filter(({ amount }) => amount > 0)
    .slice(0, 5)
    .map(({ category, amount }) => ({ cat: category, total: amount }));

  return { income, expenses, cardPurchases, balance, savingsRate, topCategories, txCount: monthTxs.length };
}

export async function generateMonthlySummary(yyyyMM) {
  const targetMonth = yyyyMM ?? previousMonthStr();

  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    throw new Error('Formato de mês inválido. Use YYYY-MM.');
  }

  const transactions = kv('finance.transactions') ?? [];
  const budgets = kv('finance.budgets') ?? [];

  const startDay = monthStartDay();
  const current = computeMonthMetrics(targetMonth, transactions, startDay);

  // Até 3 meses anteriores para comparação
  const prevMonths = [];
  for (let i = 1; i <= 3; i++) {
    const m = shiftMonth(targetMonth, -i);
    const metrics = computeMonthMetrics(m, transactions, startDay);
    if (metrics.txCount > 0) prevMonths.push({ month: m, ...metrics });
  }

  const avgIncome = prevMonths.length > 0
    ? prevMonths.reduce((s, m) => s + m.income, 0) / prevMonths.length
    : null;
  const avgExpenses = prevMonths.length > 0
    ? prevMonths.reduce((s, m) => s + m.expenses, 0) / prevMonths.length
    : null;

  const budgetStatuses = budgets
    .filter((b) => b.isActive !== false)
    .map((b) => {
      const monthTxs = transactions.filter((t) => isInFinancialMonth(t.date, targetMonth, startDay));
      const spent = budgetSpent(b, monthTxs);
      const limit = budgetLimitOf(b);
      return { name: b.name ?? budgetCategoryOf(b), category: budgetCategoryOf(b), limit, spent, exceeded: limit > 0 && spent > limit };
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

  const prompt = `Você é a Íris, assistente pessoal do Bernardo, fazendo o diagnóstico financeiro dele. Analise o mês de ${monthLabel} e gere um diagnóstico financeiro.

DADOS DE ${monthLabel.toUpperCase()}:
Receita: ${fmtBRL(current.income)}
Gastos: ${fmtBRL(current.expenses)} (dos quais no cartão de crédito, na data da compra: ${fmtBRL(current.cardPurchases)}; pagar a fatura não conta de novo)
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
