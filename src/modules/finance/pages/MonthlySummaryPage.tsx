import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ModuleHeader, Card } from '../../../shared/ui';

type CategoryEntry = { cat: string; total: number };
type BudgetStatus  = { name: string; category: string; limit: number; spent: number; exceeded: boolean };
type Comparison    = { avgIncome: number; avgExpenses: number; monthsCompared: number };

type MonthlySummary = {
  month: string;
  generatedAt: string;
  income: number;
  expenses: number;     // cash-only (expense kind)
  cardPurchases: number; // credit pool usage (informational)
  cardPayments: number;  // invoice payments (cash outflow)
  totalOutflow: number;
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
  return Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMonth(yyyyMM: string): string {
  const [yr, mo] = yyyyMM.split('-');
  return new Date(`${yr}-${mo}-15`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function pctDiff(current: number, avg: number): string {
  if (avg === 0) return '';
  const diff = ((current - avg) / avg) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(0)}% vs. média`;
}

export function MonthlySummaryPage() {
  const { yyyyMM } = useParams<{ yyyyMM: string }>();

  const [summary, setSummary]     = useState<MonthlySummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const month = yyyyMM ?? '';

  useEffect(() => {
    if (!month) return;
    setLoading(true);
    setError(null);
    fetch(`/api/finance/monthly-summary/${month}`)
      .then((r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MonthlySummary>;
      })
      .then((data) => { setSummary(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [month]);

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

      <p className="mb-6 text-xs" style={{ color: 'var(--hub-subtle)' }}>
        Gerado em {new Date(summary.generatedAt).toLocaleDateString('pt-BR')}
      </p>

      <div className="space-y-5">
        <Card>
          <p className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Visão geral
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Receita',       value: summary.income,        positive: true  },
              { label: 'Gastos',        value: -summary.expenses,     positive: false },
              ...(summary.cardPayments > 0
                ? [{ label: 'Pgto. Fatura', value: -summary.cardPayments, positive: false }]
                : []),
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
              <span className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>Saldo</span>
              <div className="text-right">
                <span
                  className="tabular-nums text-sm font-medium"
                  style={{ color: summary.balance >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)' }}
                >
                  {summary.balance >= 0 ? '' : '-'}{fmtBRL(summary.balance)}
                </span>
                <span className="ml-2 tabular-nums text-xs" style={{ color: 'var(--hub-subtle)' }}>
                  {summary.savingsRate.toFixed(1)}% poupado
                </span>
              </div>
            </div>
          </div>

          {summary.cardPurchases > 0 && (
            <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              <span className="tabular-nums">{fmtBRL(summary.cardPurchases)}</span>
              {' '}em compras no crédito · pool separado, não deduzido do saldo
            </p>
          )}

          {summary.comparison && (
            <div className="mt-4 space-y-1">
              <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                vs. média de {summary.comparison.monthsCompared} mês{summary.comparison.monthsCompared !== 1 ? 'es' : ''} anteriores
              </p>
              <p className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                receita: {pctDiff(summary.income, summary.comparison.avgIncome)} ·{' '}
                gastos: {pctDiff(summary.totalOutflow, summary.comparison.avgExpenses)}
              </p>
            </div>
          )}
        </Card>

        {summary.topCategories.length > 0 && (
          <Card>
            <p className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
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
                          {pct.toFixed(0)}%
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
            <p className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
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
          <p className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
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
            <p className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
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
