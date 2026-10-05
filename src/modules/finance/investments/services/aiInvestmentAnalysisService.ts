import { aiClient } from '../../../../core/ai/aiClient';
import { PLAIN_TEXT_RULES } from '../../../../core/ai/formatInstructions';
import { storageAdapter } from '../../../../core/storage/storage.adapter';
import { formatCurrency } from '../../utils/financeFormatters';
import { type ReserveStatus } from './reserveService';
import { type PortfolioAllocation } from './allocationService';
import { type ContributionSplit } from './contributionPlanService';

export type InvestmentAnalysis = {
  month: string;
  generatedAt: string;
  insight: string;
  suggestions: string[];
  positives: string[];
};

const STORAGE_KEY = 'finance.investments.aiAnalysis';

type InvestmentTotals = {
  patrimonio: number;
  investido: number;
  rendimento: number;
  rentabilidade: number;
};

/**
 * IA consultiva: só analisa o plano do usuário (fatias, prazo, reserva, ritmo
 * de aporte), nunca o mercado. Reforçado no próprio prompt porque é uma regra
 * do módulo, não um limite técnico do modelo — sem isso, nada
 * impede o modelo de "opinar" sobre comprar ou vender um ativo específico.
 */
function buildPrompt(
  month: string,
  totals: InvestmentTotals,
  bucketTotals: { reserva: number; carteira: number },
  reserve: ReserveStatus,
  allocation: PortfolioAllocation,
  split: ContributionSplit,
  monthlyGoal: number | null,
): string {
  const sleeveLines = allocation.sleeves
    .map((s) => `- ${s.label}: ${s.currentPercent.toFixed(1)}% de ${s.targetPercent}% (${formatCurrency(s.currentValue)})`)
    .join('\n');

  const reserveLine =
    reserve.monthsCovered !== null
      ? `${reserve.monthsCovered.toFixed(1)} de ${reserve.targetMonths} meses de gasto (${formatCurrency(reserve.currentValue)} guardados, gasto médio ${formatCurrency(reserve.monthlyExpenseAverage)}/mês)`
      : 'sem gasto médio suficiente pra medir em meses ainda';

  const splitLine = split.deadlineActive
    ? split.feasible
      ? `Aporte de ${formatCurrency(split.totalAmount)}/mês dividido: ${formatCurrency(split.reserveAmount)} pra reserva, ${formatCurrency(split.portfolioAmount)} pra carteira — reserva fecha em ${split.monthsToDeadline} meses.`
      : `Prazo da reserva definido não fecha com o aporte atual — faltariam ${formatCurrency(split.shortfallPerMonth ?? 0)}/mês a mais.`
    : monthlyGoal
      ? `Sem prazo definido pra reserva — aporte de ${formatCurrency(monthlyGoal)}/mês vai inteiro pra carteira.`
      : 'Nenhuma meta de aporte mensal definida ainda.';

  return `Você é um assistente financeiro pessoal, consultivo. Analise o estado ATUAL da carteira de investimentos de Bernardo e gere um resumo em português.

REGRA ABSOLUTA: você só pode falar sobre o PLANO dele — fatias de alocação, prazo da reserva, ritmo de aporte, progresso. NUNCA opine sobre mercado, sobre um ativo específico, sobre comprar/vender, sobre timing, sobre desempenho de bolsa/juros/câmbio. Se um dado sugerir isso, ignore — fale só do que está sob controle dele: o plano.

Patrimônio total: ${formatCurrency(totals.patrimonio)}
Total investido: ${formatCurrency(totals.investido)}
Rendimento: ${formatCurrency(totals.rendimento)} (${totals.rentabilidade.toFixed(2)}%)
Reserva de emergência: ${formatCurrency(bucketTotals.reserva)} — ${reserveLine}
Carteira (fora da reserva): ${formatCurrency(bucketTotals.carteira)}

Alocação da carteira (atual % de alvo %):
${sleeveLines || '- Carteira vazia ainda'}

Aporte mensal: ${splitLine}

${PLAIN_TEXT_RULES}

Gere um resumo prático e honesto do mês. Responda APENAS com JSON:
{
  "insight": "resumo geral de 2-3 frases sobre o estado do plano",
  "suggestions": ["sugestão 1 sobre o plano (nunca sobre mercado)", "sugestão 2"],
  "positives": ["ponto positivo 1", "ponto positivo 2"]
}`;
}

export const aiInvestmentAnalysisService = {
  getCachedAnalysis(month: string): InvestmentAnalysis | null {
    const all = storageAdapter.getItem<InvestmentAnalysis[]>(STORAGE_KEY) ?? [];
    return all.find((a) => a.month === month) ?? null;
  },

  async analyzeMonth(
    month: string,
    totals: InvestmentTotals,
    bucketTotals: { reserva: number; carteira: number },
    reserve: ReserveStatus,
    allocation: PortfolioAllocation,
    split: ContributionSplit,
    monthlyGoal: number | null,
  ): Promise<InvestmentAnalysis> {
    const prompt = buildPrompt(month, totals, bucketTotals, reserve, allocation, split, monthlyGoal);

    const result = await aiClient.completeJson<{
      insight: string;
      suggestions: string[];
      positives: string[];
    }>(prompt);

    const analysis: InvestmentAnalysis = {
      month,
      generatedAt: new Date().toISOString(),
      insight: result.insight,
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      positives: Array.isArray(result.positives) ? result.positives : [],
    };

    // Persiste somente os últimos 3 meses de análises — mesmo limite da análise financeira geral.
    const all = storageAdapter.getItem<InvestmentAnalysis[]>(STORAGE_KEY) ?? [];
    const filtered = all.filter((a) => a.month !== month);
    storageAdapter.setItem(STORAGE_KEY, [analysis, ...filtered].slice(0, 3));

    return analysis;
  },
};
