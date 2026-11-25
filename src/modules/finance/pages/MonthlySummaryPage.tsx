import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ModuleHeader, Card } from '../../../shared/ui';
import { formatMonthLabel, isValidMonthKey } from '../utils/financePeriod';

type CategoryEntry = { cat: string; total: number };
type BudgetStatus  = { name: string; category: string; limit: number; spent: number; exceeded: boolean };
type Comparison    = { avgIncome: number; avgExpenses: number; monthsCompared: number };

type MonthlySummary = {
  month: string;
  generatedAt: string;
  income: number;
  /** Everything consumed in the month, card purchases included (summaries since 2026-11). */
  expenses: number;
  /** The part of `expenses` bought on the credit card. */
  cardPurchases: number;
  balance: number;
  savingsRate: number;
  topCategories: CategoryEntry[];
  budgetStatuses: BudgetStatus[];
  comparison: Comparison | null;
  diagnosis: string;
  highlights: string[];
  recommendations: string[];
};

function fmtBRL(n: number): string {
  return Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMonth(yyyyMM: string): string {
  return isValidMonthKey(yyyyMM) ? formatMonthLabel(yyyyMM) : yyyyMM;
}

function pctDiff(current: number, avg: number): string {
  if (avg === 0) return '';
  const diff = ((current - avg) / avg) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${Math.round(diff).toLocaleString('pt-BR')}% vs. média`;
}

export function MonthlySummaryPage() {
  const { yyyyMM } = useParams<{ yyyyMM: string }>();

  const [summary, setSummary]     = useState<MonthlySummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  /** The server failed to answer — not the same as "not generated yet". */
  const [loadError, setLoadError] = useState<string | null>(null);

  const month = yyyyMM ?? '';

  const validMonth = isValidMonthKey(month);

  useEffect(() => {
    if (!validMonth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setLoadError(null);
    fetch(`/api/finance/monthly-summary/${month}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MonthlySummary>;
      })
      .then((data) => { setSummary(data); setLoading(false); })
      .catch((e) => { setLoadError(e instanceof Error ? e.message : String(e)); setLoading(false); });
  }, [month, validMonth]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/monthly-summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar resumo');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Financeiro" title="Resumo mensal" back />
        <div className="py-10 text-center text-sm" style={{ color: 'var(--hub-subtle)' }}>
          Carregando…
        </div>
      </div>
    );
  }

  if (!validMonth || loadError) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Financeiro" title="Resumo mensal" back />
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
            {validMonth ? 'Não foi possível carregar o resumo.' : `"${month}" não é um mês válido.`}
          </p>
          {loadError ? (
            <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{loadError}</p>
          ) : null}
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Financeiro" title={`Resumo — ${fmtMonth(month)}`} back />
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
            Resumo de {fmtMonth(month)} ainda não gerado.
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            O resumo é gerado automaticamente no dia 6 de cada mês. Você pode gerar agora manualmente (requer a IA configurada).
          </p>
          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {generating ? 'Gerando…' : 'Gerar agora'}
          </button>
        </Card>
      </div>
    );
  }

  const totalCats = summary.topCategories.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title={fmtMonth(summary.month)} back />

      <p className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
        <span>Gerado em {new Date(summary.generatedAt).toLocaleDateString('pt-BR')}</span>
        {/* After recategorizing the month, the stored summary is stale. */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {generating ? 'Gerando…' : 'Gerar de novo'}
        </button>
        {error ? <span style={{ color: 'var(--hub-negative)' }}>{error}</span> : null}
      </p>

      <div className="space-y-5">
        <Card>
          <p className="mb-3 font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Visão geral
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Recebi', value: summary.income,    positive: true  },
              { label: 'Gastei', value: -summary.expenses, positive: false },
            ].map(({ label, value, positive }) => (
              <div key={label} className="flex items-baseline justify-between">
                <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>{label}</span>
                <span
                  className="tabular-nums text-sm font-medium"
                  style={{ color: positive ? 'var(--hub-positive)' : value < 0 ? 'var(--hub-negative)' : 'var(--hub-muted)' }}
                >
                  {value >= 0 ? '' : '-'}{fmtBRL(value)}
                </span>
              </div>
            ))}
            <div
              className="flex items-baseline justify-between pt-2"
              style={{ borderTop: '1px solid var(--hub-border)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Sobrou</span>
              <div className="text-right">
                <span
                  className="tabular-nums text-sm font-medium"
                  style={{ color: summary.balance >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)' }}
                >
                  {summary.balance >= 0 ? '' : '-'}{fmtBRL(summary.balance)}
                </span>
                <span className="ml-2 tabular-nums text-xs" style={{ color: 'var(--hub-subtle)' }}>
                  {summary.savingsRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% poupado
                </span>
              </div>
            </div>
          </div>

          {summary.cardPurchases > 0 && (
            <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              <span className="tabular-nums">{fmtBRL(summary.cardPurchases)}</span>
              {' '}do gasto foi no cartão de crédito
            </p>
          )}

          {summary.comparison && (
            <div className="mt-4 space-y-1">
              <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                vs. média {summary.comparison.monthsCompared === 1 ? 'do mês anterior' : `dos ${summary.comparison.monthsCompared} meses anteriores`}
              </p>
              <p className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                receita: {pctDiff(summary.income, summary.comparison.avgIncome)} ·{' '}
                gastos: {pctDiff(summary.expenses, summary.comparison.avgExpenses)}
              </p>
            </div>
          )}
        </Card>

        {summary.topCategories.length > 0 && (
          <Card>
            <p className="mb-3 font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
              Top categorias
            </p>
            <div className="space-y-2.5">
              {summary.topCategories.map(({ cat, total }) => {
                const pct = totalCats > 0 ? (total / totalCats) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm capitalize" style={{ color: 'var(--hub-text-body)' }}>{cat}</span>
                      <div className="flex items-baseline gap-3">
                        <span className="tabular-nums text-xs" style={{ color: 'var(--hub-subtle)' }}>
                          {Math.round(pct)}%
                        </span>
                        <span className="tabular-nums text-sm" style={{ color: 'var(--hub-text)' }}>
                          {fmtBRL(total)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 h-0.5 w-full rounded-full" style={{ background: 'var(--hub-border)' }}>
                      <div
                        className="h-0.5 rounded-full"
                        style={{ width: `${pct}%`, background: 'color-mix(in srgb, var(--hub-accent) 60%, transparent)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {summary.budgetStatuses.length > 0 && (
          <Card>
            <p className="mb-3 font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
              Orçamentos
            </p>
            <div className="space-y-2.5">
              {summary.budgetStatuses.map((b) => {
                const pct = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 0;
                return (
                  <div key={b.category}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>{b.name}</span>
                      <span
                        className="tabular-nums text-xs font-medium"
                        style={{ color: b.exceeded ? 'var(--hub-negative)' : 'var(--hub-subtle)' }}
                      >
                        {fmtBRL(b.spent)} / {fmtBRL(b.limit)}
                      </span>
                    </div>
                    <div className="mt-1 h-0.5 w-full rounded-full" style={{ background: 'var(--hub-border)' }}>
                      <div
                        className="h-0.5 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: b.exceeded ? 'var(--hub-negative)' : 'color-mix(in srgb, var(--hub-positive) 60%, transparent)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <p className="mb-3 font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Diagnóstico
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--hub-text-body)' }}>
            {summary.diagnosis}
          </p>

          {summary.highlights.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {summary.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--hub-text-body)' }}>
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: 'var(--hub-disabled)' }} />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {summary.recommendations.length > 0 && (
          <Card>
            <p className="mb-3 font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
              Para o próximo mês
            </p>
            <ol className="space-y-3">
              {summary.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 shrink-0 tabular-nums text-xs font-medium"
                    style={{ color: 'var(--hub-accent)', minWidth: '16px' }}
                  >
                    {i + 1}.
                  </span>
                  <p className="text-sm" style={{ color: 'var(--hub-text-body)' }}>{r}</p>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {error && (
          <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
