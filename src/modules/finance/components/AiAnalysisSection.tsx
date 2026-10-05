import { useState } from 'react';
import { Card } from '../../../shared/ui';
import { aiFinanceAnalysisService, type FinanceAnalysis } from '../services/aiFinanceAnalysisService';
import { type MonthlyCategoryComparison, type MonthlyFinanceSummary } from '../types/finance';
import { formatMonthLabel } from '../utils/financePeriod';

/**
 * Análise por IA do mês selecionado, embutida em Relatórios — reaproveita
 * summary/categoryComparison já calculados pela página em vez de refetch.
 */
export function AiAnalysisSection({
  selectedMonth,
  summary,
  categoryComparison,
  budgetExceededCount,
}: {
  selectedMonth: string;
  summary: MonthlyFinanceSummary;
  categoryComparison: MonthlyCategoryComparison[];
  budgetExceededCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FinanceAnalysis | null>(
    () => aiFinanceAnalysisService.getCachedAnalysis(selectedMonth),
  );

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const result = await aiFinanceAnalysisService.analyzeMonth(
        selectedMonth,
        summary,
        categoryComparison,
        budgetExceededCount,
      );
      setAnalysis(result);
    } catch (_err) {
      setError('Falha ao gerar análise. Verifique a chave de IA nas configurações.');
    } finally {
      setLoading(false);
    }
  }

  const monthLabel = formatMonthLabel(selectedMonth);
  const isCached = analysis !== null && analysis.month === selectedMonth;

  return (
    <Card className="mb-5">
      <p
        className="font-medium uppercase"
        style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}
      >
        Análise IA
      </p>

      <button
        disabled={loading}
        className="transition-opacity hover:opacity-70"
        style={{
          display: 'block',
          marginBottom: analysis && analysis.month === selectedMonth ? '28px' : 0,
          background: 'none',
          border: 'none',
          color: loading ? 'color-mix(in srgb, var(--hub-accent) 50%, transparent)' : 'color-mix(in srgb, var(--hub-accent) 90%, transparent)',
          fontSize: '13px',
          fontWeight: 500,
          padding: 0,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        onClick={handleAnalyze}
      >
        {loading ? 'Analisando…' : isCached ? `✨ Reanalisar ${monthLabel}` : `✨ Analisar ${monthLabel}`}
      </button>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--hub-negative)', marginBottom: '24px' }}>{error}</p>
      )}

      {analysis && analysis.month === selectedMonth && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'color-mix(in srgb, var(--hub-accent) 75%, transparent)', marginBottom: '10px' }}>
              Análise geral
            </p>
            <p style={{ fontSize: '13px', color: 'var(--hub-text-body)', lineHeight: 1.7 }}>{analysis.insight}</p>
          </div>

          {(analysis.positives.length > 0 || analysis.suggestions.length > 0) && (
            <div style={{ height: '1px', background: 'var(--hub-border)' }} />
          )}

          {analysis.positives.length > 0 && (
            <div>
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'color-mix(in srgb, var(--hub-positive) 75%, transparent)', marginBottom: '12px' }}>
                Pontos positivos
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analysis.positives.map((p, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: 'var(--hub-positive)', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '13px', color: 'var(--hub-text-body)', lineHeight: 1.6 }}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.suggestions.length > 0 && (
            <div>
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-warning)', marginBottom: '12px' }}>
                Sugestões
              </p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analysis.suggestions.map((s, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: 'var(--hub-warning)', flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: '13px', color: 'var(--hub-text-body)', lineHeight: 1.6 }}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p style={{ fontSize: '10px', color: 'var(--hub-disabled)', textAlign: 'center' }}>
            Gerado em {new Date(analysis.generatedAt).toLocaleString('pt-BR')}
          </p>
        </div>
      )}
    </Card>
  );
}
