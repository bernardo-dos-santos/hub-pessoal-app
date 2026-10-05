import { aiClient } from '../../../core/ai/aiClient';
import { PLAIN_TEXT_RULES } from '../../../core/ai/formatInstructions';
import { storageAdapter } from '../../../core/storage/storage.adapter';
import { formatCurrency } from '../utils/financeFormatters';
import { type MonthlyFinanceSummary } from '../types/finance';
import { type MonthlyCategoryComparison } from '../types/finance';

export type FinanceAnalysis = {
  month: string;
  generatedAt: string;
  insight: string;
  suggestions: string[];
  positives: string[];
};

const STORAGE_KEY = 'finance.aiAnalysis';

function buildPrompt(
  month: string,
  summary: MonthlyFinanceSummary,
  categoryComparison: MonthlyCategoryComparison[],
  budgetExceeded: number,
): string {
  const balance = summary.balance;
  const topCategories = categoryComparison
    .slice(0, 6)
    .map(
      (c) =>
        `- ${c.category}: ${formatCurrency(c.currentAmount)} (${c.previousAmount > 0 ? (c.currentAmount > c.previousAmount ? `↑ ${formatCurrency(c.currentAmount - c.previousAmount)} vs mês anterior` : `↓ ${formatCurrency(c.previousAmount - c.currentAmount)} vs mês anterior`) : 'sem dado anterior'})`,
    )
    .join('\n');

  return `Você é um assistente financeiro pessoal. Analise os dados financeiros do mês ${month} e gere insights úteis em português.

Resumo do mês:
- Receitas: ${formatCurrency(summary.income)}
- Despesas: ${formatCurrency(summary.expenses)}
- Resultado: ${formatCurrency(balance)} (${balance >= 0 ? 'positivo' : 'NEGATIVO'})
- Cartão de crédito: ${formatCurrency(summary.cardPurchases)}
- Total de transações: ${summary.transactionCount}
- Orçamentos excedidos: ${budgetExceeded}

Top categorias de gasto:
${topCategories || '- Sem dados de categorias'}

${PLAIN_TEXT_RULES}

Gere uma análise financeira pessoal e prática. Responda APENAS com JSON:
{
  "insight": "análise geral de 2-3 frases sobre o mês",
  "suggestions": ["sugestão 1 acionável", "sugestão 2 acionável", "sugestão 3 acionável"],
  "positives": ["ponto positivo 1", "ponto positivo 2"]
}`;
}

export const aiFinanceAnalysisService = {
  getCachedAnalysis(month: string): FinanceAnalysis | null {
    const all = storageAdapter.getItem<FinanceAnalysis[]>(STORAGE_KEY) ?? [];
    return all.find((a) => a.month === month) ?? null;
  },

  async analyzeMonth(
    month: string,
    summary: MonthlyFinanceSummary,
    categoryComparison: MonthlyCategoryComparison[],
    budgetExceeded: number,
  ): Promise<FinanceAnalysis> {
    const prompt = buildPrompt(month, summary, categoryComparison, budgetExceeded);

    const result = await aiClient.completeJson<{
      insight: string;
      suggestions: string[];
      positives: string[];
    }>(prompt);

    const analysis: FinanceAnalysis = {
      month,
      generatedAt: new Date().toISOString(),
      insight: result.insight,
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      positives: Array.isArray(result.positives) ? result.positives : [],
    };

    // Persiste somente os últimos 3 meses de análises
    const all = storageAdapter.getItem<FinanceAnalysis[]>(STORAGE_KEY) ?? [];
    const filtered = all.filter((a) => a.month !== month);
    storageAdapter.setItem(STORAGE_KEY, [analysis, ...filtered].slice(0, 3));

    return analysis;
  },
};
