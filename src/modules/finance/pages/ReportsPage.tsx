import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { AiAnalysisSection } from '../components/AiAnalysisSection';
import { MonthSelector } from '../components/MonthSelector';
import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { FinanceChartCard, FinanceChartEmptyState } from '../components/charts/FinanceChartCard';
import { budgetService } from '../services/budgetService';
import { BudgetUsageChart } from '../components/charts/BudgetUsageChart';
import { financeSummaryService } from '../services/financeSummaryService';
import { transactionService } from '../services/transactionService';
import { formatCurrency, formatPercentage } from '../utils/financeFormatters';
import {
  formatMonthLabel,
  getMonthKeyFromQuery,
  withMonthAndCategoryParams,
  withMonthParam,
} from '../utils/financePeriod';
import { type MonthlyEvolutionPoint } from '../types/finance';

// ─── Helpers ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS = [
  '#38bdf8', '#818cf8', '#a78bfa', '#f472b6',
  '#fb923c', '#34d399', '#facc15', '#60a5fa',
];

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── SVG Line Chart (Trend) ────────────────────────────────────────────────

type TrendSeries = {
  key: 'income' | 'expenses' | 'balance';
  label: string;
  color: string;
  dash?: string;
};

const TREND_SERIES: TrendSeries[] = [
  { key: 'income',   label: 'Receitas',  color: '#34d399' },
  { key: 'expenses', label: 'Despesas',  color: '#f87171' },
  { key: 'balance',  label: 'Resultado', color: '#38bdf8', dash: '6 3' },
];

function smoothPath(pts: Array<{ x: number; y: number }>) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (curr.x - prev.x) / 2.5;
    d += ` C ${(prev.x + cpx).toFixed(2)} ${prev.y.toFixed(2)},`
       + ` ${(curr.x - cpx).toFixed(2)} ${curr.y.toFixed(2)},`
       + ` ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }
  return d;
}

function TrendLineChart({ data }: { data: MonthlyEvolutionPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<Set<string>>(
    new Set(TREND_SERIES.map((s) => s.key)),
  );

  const W = 640, H = 200, PX = 48, PY = 16;
  const cw = W - PX * 2;
  const ch = H - PY * 2;
  const n = data.length;

  const maxVal = useMemo(
    () => Math.max(...data.flatMap((p) => [p.income, p.expenses, Math.abs(p.balance)]), 1),
    [data],
  );

  function getX(i: number) { return PX + (i / Math.max(n - 1, 1)) * cw; }
  function getY(v: number) { return PY + ch - (Math.max(v, 0) / maxVal) * ch; }
  function getYSigned(v: number) { return PY + ch - ((v + maxVal) / (2 * maxVal)) * ch; }

  function toggleSeries(key: string) {
    setActiveSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key) && next.size > 1) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hoverData = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div>
      {/* Legenda interativa */}
      <div className="mb-4 flex flex-wrap gap-3">
        {TREND_SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`flex items-center gap-1.5 text-xs font-medium transition-all ${
              activeSeries.has(s.key)
                ? 'opacity-100'
                : 'opacity-30'
            }`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, padding: 0 }}
            onClick={() => toggleSeries(s.key)}
          >
            <span className="h-0.5 w-4" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative" onMouseLeave={() => setHoverIdx(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          style={{ height: 200 }}
          aria-label="Tendência mensal"
        >
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={PX} y1={PY + ch * (1 - t)}
              x2={PX + cw} y2={PY + ch * (1 - t)}
              stroke="var(--hub-border-strong)" strokeWidth={1}
            />
          ))}

          {/* Linhas do gráfico */}
          {TREND_SERIES.filter((s) => activeSeries.has(s.key)).map((s) => {
            const pts = data.map((p, i) => ({
              x: getX(i),
              y: s.key === 'balance' ? getYSigned(p[s.key]) : getY(p[s.key]),
            }));
            const path = smoothPath(pts);

            return (
              <g key={s.key}>
                {/* Área preenchida */}
                <path
                  d={`${path} L ${getX(n - 1)} ${PY + ch} L ${PX} ${PY + ch} Z`}
                  fill={s.color}
                  fillOpacity={0.06}
                />
                {/* Linha */}
                <path
                  d={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Pontos */}
                {pts.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x} cy={pt.y} r={hoverIdx === i ? 4 : 2.5}
                    fill={s.color}
                    fillOpacity={hoverIdx === i ? 1 : 0.6}
                    className="transition-all"
                  />
                ))}
              </g>
            );
          })}

          {/* Linha de hover */}
          {hoverIdx !== null && (
            <line
              x1={getX(hoverIdx)} y1={PY}
              x2={getX(hoverIdx)} y2={PY + ch}
              stroke="var(--hub-text)" strokeOpacity={0.15} strokeWidth={1}
            />
          )}

          {/* Rótulos do eixo X */}
          {data.map((p, i) => (
            <text
              key={i}
              x={getX(i)} y={H - 2}
              textAnchor="middle"
              fill={hoverIdx === i ? 'var(--hub-text)' : 'var(--hub-subtle)'}
              fontSize={9}
              className="capitalize select-none"
            >
              {p.label.slice(0, 3)}
            </text>
          ))}

          {/* Áreas de hover invisíveis */}
          {data.map((_, i) => {
            const step = cw / Math.max(n - 1, 1);
            return (
              <rect
                key={i}
                x={getX(i) - step / 2} y={PY}
                width={step} height={ch}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoverData && hoverIdx !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[140px] text-xs"
            style={{
              left: `${(getX(hoverIdx) / W) * 100}%`,
              transform: hoverIdx > n / 2 ? 'translateX(-105%)' : 'translateX(8px)',
              background: 'var(--hub-card)',
              border: '1px solid var(--hub-border-strong)',
              borderRadius: '10px',
              padding: '10px 12px',
              boxShadow: 'var(--hub-shadow-menu)',
            }}
          >
            <p className="mb-2 font-semibold capitalize" style={{ color: 'var(--hub-text)' }}>{hoverData.label}</p>
            {TREND_SERIES.filter((s) => activeSeries.has(s.key)).map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5" style={{ color: s.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--hub-text)' }}>
                  {formatCurrency(hoverData[s.key])}
                </span>
              </div>
            ))}
            <p className="mt-2 pt-2" style={{ borderTop: '1px solid var(--hub-border)', color: 'var(--hub-subtle)' }}>
              {hoverData.transactionCount} lançamento{hoverData.transactionCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Donut Chart (Categorias) ─────────────────────────────────────────────

type DonutItem = { category: string; amount: number; transactionsCount: number; href?: string };

function DonutCategoryChart({
  items,
  selectedMonth,
}: {
  items: DonutItem[];
  selectedMonth: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.amount, 0);
  const R = 52, cx = 80, cy = 80;
  const SW = 16;       // espessura normal do anel
  const GAP_PX = 2;    // gap em px entre segmentos
  const C = 2 * Math.PI * R;

  // Fórmula correta do donut:
  // - rotate(-90deg) no estilo → path começa às 12h
  // - dashOffset = -C * cumulativeStart → cada segmento começa onde o anterior terminou
  // - GAP subtraído do dashLen → separação visual limpa, sem arredondamento que sobrepõe
  const segments = useMemo(() => {
    let cumStart = 0;
    return items.map((item, idx) => {
      const pct = item.amount / total;
      const dashLen = Math.max(C * pct - GAP_PX, 0);
      const dashOffset = -C * cumStart;
      cumStart += pct;
      return { ...item, pct, dashLen, dashOffset, idx };
    });
  }, [items, total, C]);

  const focused = selected ?? hovered;
  const focusedItem = items.find((i) => i.category === focused);

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
      {/* Donut SVG */}
      <div className="flex items-center justify-center">
        <svg
          viewBox="0 0 160 160"
          className="w-full max-w-[200px]"
          role="img"
          aria-label="Distribuição de gastos por categoria"
          style={{ overflow: 'visible' }}
        >
          {/* Pista de fundo */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--hub-border-strong)" strokeWidth={SW} />

          {/* Segmentos — sem strokeLinecap rounded (causa sobreposição) */}
          {segments.map((seg) => {
            const isActive = focused === seg.category;
            const color = CATEGORY_COLORS[seg.idx % CATEGORY_COLORS.length];
            return (
              <circle
                key={seg.category}
                cx={cx} cy={cy} r={R}
                fill="none"
                stroke={color}
                strokeWidth={SW}
                strokeDasharray={`${seg.dashLen} ${C - seg.dashLen}`}
                strokeLinecap="butt"
                className="cursor-pointer"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: `${cx}px ${cy}px`,
                  strokeDashoffset: seg.dashOffset,
                  opacity: focused && !isActive ? 0.3 : 1,
                  transition: 'opacity 0.2s',
                  filter: isActive ? `drop-shadow(0 0 4px ${color}80)` : undefined,
                }}
                onMouseEnter={() => setHovered(seg.category)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(selected === seg.category ? null : seg.category)}
              />
            );
          })}

          {/* Centro */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--hub-text)" fontSize={11} fontWeight="bold">
            {focusedItem
              ? formatCurrency(focusedItem.amount).replace('R$ ', '')
              : formatCurrency(total).replace('R$ ', '')}
          </text>
          <text x={cx} y={cy + 6} textAnchor="middle" fill="var(--hub-subtle)" fontSize={7.5}>
            {focusedItem
              ? focusedItem.category.length > 14
                ? focusedItem.category.slice(0, 14) + '…'
                : focusedItem.category
              : 'total gastos'}
          </text>
          {focusedItem && (
            <text x={cx} y={cy + 18} textAnchor="middle" fill="var(--hub-muted)" fontSize={7}>
              {formatPercentage((focusedItem.amount / total) * 100)}
            </text>
          )}
        </svg>
      </div>

      {/* Lista de categorias */}
      <div className="grid gap-1.5 content-start">
        {segments.map((seg) => {
          const isActive = focused === seg.category;
          const color = CATEGORY_COLORS[seg.idx % CATEGORY_COLORS.length];
          return (
            <a
              key={seg.category}
              href={withMonthAndCategoryParams('/financeiro/transacoes', selectedMonth, seg.category)}
              className="flex items-center gap-3 text-xs transition-opacity hover:opacity-70"
              style={{ paddingBottom: '8px', marginBottom: '8px', borderBottom: '1px solid var(--hub-border)', opacity: isActive ? 1 : undefined }}
              onMouseEnter={() => setHovered(seg.category)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => { e.preventDefault(); setSelected(selected === seg.category ? null : seg.category); }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="min-w-0 flex-1 truncate font-medium" style={{ color: 'var(--hub-text)' }}>
                {seg.category}
              </span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
                {formatCurrency(seg.amount)}
              </span>
              <span className="shrink-0" style={{ color: 'var(--hub-subtle)' }}>
                {formatPercentage(seg.pct * 100)}
              </span>
            </a>
          );
        })}
        {selected && (
          <a
            href={withMonthAndCategoryParams('/financeiro/transacoes', selectedMonth, selected)}
            className="transition-opacity hover:opacity-70"
            style={{ display: 'block', textAlign: 'center', marginTop: '8px', fontSize: '11px', color: 'var(--hub-accent)' }}
          >
            Ver transações de {selected} →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Bar Chart: gastos por dia da semana ──────────────────────────────────

const MAX_BAR_H = 100; // altura máxima da barra em px

function WeekdayChart({ transactions }: { transactions: Array<{ date: string; amount: number; kind: string }> }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Inclui qualquer saída de dinheiro (exceto transferências internas)
  // kind pode ser: 'expense', 'card_purchase', 'review' (pendente), etc.
  const expenses = transactions.filter(
    (t) => t.amount < 0 && t.kind !== 'card_payment' && t.kind !== 'card_payment_received',
  );

  const byDay = useMemo(() => {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    expenses.forEach((t) => {
      const day = new Date(t.date + 'T12:00:00').getDay();
      sums[day] += Math.abs(t.amount);
      counts[day]++;
    });
    return DAY_LABELS.map((label, i) => ({ label, amount: sums[i], count: counts[i] }));
  }, [expenses]);

  const max = Math.max(...byDay.map((d) => d.amount), 0.01);
  const hasData = byDay.some((d) => d.amount > 0);

  if (!hasData) {
    return <FinanceChartEmptyState>Sem despesas no mês para analisar por dia da semana.</FinanceChartEmptyState>;
  }

  return (
    <div>
      {/* Barras — usando px absolutos para garantir renderização correta */}
      <div className="flex items-end gap-1" style={{ height: `${MAX_BAR_H + 8}px` }}>
        {byDay.map((day, i) => {
          // altura em px: mínimo 3px para dias sem gasto (traço), proporcional para dias com gasto
          const barHeight = day.amount > 0
            ? Math.max(Math.round((day.amount / max) * MAX_BAR_H), 6)
            : 3;
          const isActive = hovered === i;

          return (
            <div
              key={day.label}
              className="relative flex flex-1 cursor-pointer flex-col items-center"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isActive && day.amount > 0 && (
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap text-xs"
                  style={{ background: 'var(--hub-card)', border: '1px solid var(--hub-border-strong)', borderRadius: '10px', padding: '6px 10px', boxShadow: 'var(--hub-shadow-menu)' }}
                >
                  <p className="font-semibold" style={{ color: 'var(--hub-text)' }}>{day.label}</p>
                  <p className="mt-0.5 font-bold tabular-nums" style={{ color: 'var(--hub-accent)' }}>{formatCurrency(day.amount)}</p>
                  <p className="mt-0.5" style={{ color: 'var(--hub-subtle)' }}>{day.count} lançamento{day.count !== 1 ? 's' : ''}</p>
                </div>
              )}
              {/* Barra */}
              <div
                className="w-full rounded-t-sm transition-all duration-200"
                style={{
                  height: `${barHeight}px`,
                  background: day.amount === 0
                    ? 'var(--hub-border)'
                    : isActive
                      ? 'var(--hub-accent)'
                      : 'color-mix(in srgb, var(--hub-accent) 55%, transparent)',
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Labels dos dias */}
      <div className="mt-2 flex gap-1">
        {byDay.map((day, i) => (
          <div
            key={day.label}
            className="flex-1 text-center text-[10px] transition-colors"
            style={{ color: hovered === i ? 'var(--hub-text-body)' : 'var(--hub-subtle)' }}
          >
            {day.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Savings Rate Sparkline ───────────────────────────────────────────────

function SavingsRateChart({ data }: { data: MonthlyEvolutionPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const points = data.map((p) => ({
    month: p.month,
    label: p.label,
    rate: p.income > 0 ? ((p.income - p.expenses) / p.income) * 100 : 0,
    income: p.income,
    expenses: p.expenses,
  }));

  const W = 400, H = 80, PX = 8, PY = 8;
  const cw = W - PX * 2;
  const ch = H - PY * 2;
  const minRate = Math.min(...points.map((p) => p.rate), -20);
  const maxRate = Math.max(...points.map((p) => p.rate), 20);
  const range = maxRate - minRate || 1;
  const n = points.length;

  function getX(i: number) { return PX + (i / Math.max(n - 1, 1)) * cw; }
  function getY(v: number) { return PY + ch - ((v - minRate) / range) * ch; }

  const zero = getY(0);
  const pts = points.map((p, i) => ({ x: getX(i), y: getY(p.rate) }));
  const path = smoothPath(pts);

  return (
    <div className="relative" onMouseLeave={() => setHoverIdx(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: 80 }}>
        {/* Zero line */}
        <line x1={PX} y1={zero} x2={PX + cw} y2={zero} stroke="var(--hub-border-strong)" strokeWidth={1} />

        {/* Área positiva */}
        <clipPath id="posClip">
          <rect x={0} y={0} width={W} height={zero} />
        </clipPath>
        <path d={`${path} L ${getX(n-1)} ${H} L ${PX} ${H} Z`} fill="#34d399" fillOpacity={0.12} clipPath="url(#posClip)" />

        {/* Área negativa */}
        <clipPath id="negClip">
          <rect x={0} y={zero} width={W} height={H - zero} />
        </clipPath>
        <path d={`${path} L ${getX(n-1)} ${H} L ${PX} ${H} Z`} fill="#f87171" fillOpacity={0.12} clipPath="url(#negClip)" />

        {/* Linha */}
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" />

        {/* Pontos */}
        {pts.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x} cy={pt.y} r={hoverIdx === i ? 4 : 2.5}
            fill={points[i].rate >= 0 ? '#34d399' : '#f87171'}
            className="transition-all"
          />
        ))}

        {/* Hover areas */}
        {points.map((_, i) => {
          const step = cw / Math.max(n - 1, 1);
          return (
            <rect key={i} x={getX(i) - step / 2} y={0} width={step} height={H}
              fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-[130px] text-xs"
          style={{
            left: `${(getX(hoverIdx) / W) * 100}%`,
            transform: hoverIdx > n / 2 ? 'translateX(-105%)' : 'translateX(4px)',
            background: 'var(--hub-card)',
            border: '1px solid var(--hub-border-strong)',
            borderRadius: '10px',
            padding: '8px 10px',
            boxShadow: 'var(--hub-shadow-menu)',
          }}
        >
          <p className="mb-1 capitalize font-semibold" style={{ color: 'var(--hub-text)' }}>{points[hoverIdx].label}</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: points[hoverIdx].rate >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)' }}>
            {points[hoverIdx].rate.toFixed(1)}% poupança
          </p>
          <div className="mt-1 space-y-0.5" style={{ color: 'var(--hub-muted)' }}>
            <p>Rec: {formatCurrency(points[hoverIdx].income)}</p>
            <p>Desp: {formatCurrency(points[hoverIdx].expenses)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMonth = getMonthKeyFromQuery(searchParams.get('month'));
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;
  const transactions = transactionService.listTransactions();
  const monthlyTransactions = transactions.filter((t) => t.date.startsWith(selectedMonth));
  const monthlyEvolution12 = financeSummaryService.getMonthlyEvolution(selectedMonth, 12);
  const monthlyComparison = financeSummaryService.getMonthlyComparison(selectedMonth);
  const categoryComparison = financeSummaryService.getMonthlyCategoryComparison(selectedMonth);
  const categoryExpenses = financeSummaryService
    .getCategoryExpenses(selectedMonth)
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const summary = financeSummaryService.getFinanceSummary(selectedMonth);
  const budgetUsageItems = budgetService.listActiveBudgets().map((budget) => ({
    budget,
    ...budgetService.getBudgetUsage(budget, transactions, selectedMonth),
  }));
  const monthsWithData = monthlyEvolution12.filter((p) => p.transactionCount > 0);
  const bestMonth = monthsWithData.length
    ? monthsWithData.reduce((a, b) => (b.balance > a.balance ? b : a))
    : null;
  const worstMonth = monthsWithData.length
    ? monthsWithData.reduce((a, b) => (b.balance < a.balance ? b : a))
    : null;
  const avgIncome = monthsWithData.length
    ? monthsWithData.reduce((s, p) => s + p.income, 0) / monthsWithData.length
    : 0;
  const avgExpenses = monthsWithData.length
    ? monthsWithData.reduce((s, p) => s + p.expenses, 0) / monthsWithData.length
    : 0;
  const savingsRate = summary.income > 0
    ? ((summary.income - summary.expenses) / summary.income) * 100
    : 0;
  const largestCategory = categoryExpenses[0] ?? null;

  function changeMonth(month: string) {
    const next = new URLSearchParams(searchParams);
    next.set('month', getMonthKeyFromQuery(month));
    setSearchParams(next);
  }

  return (
    <div>
      <ModuleHeader
        eyebrow="Módulo · Financeiro"
        title="Relatórios"
        tabs={getFinanceTabs(pendingReviewCount)}
       
        right={<MonthSelector value={selectedMonth} onChange={changeMonth} />}
      />

      <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
        Gráficos interativos — passe o mouse para explorar. Reembolsos pareados ficam fora dos cálculos.
      </p>

      {/* KPIs do mês */}
      <Card className="mb-5">
        <div className="flex flex-wrap" style={{ gap: '28px 40px' }}>
          <KpiInline
            label="Taxa de poupança"
            value={`${savingsRate.toFixed(1)}%`}
            detail={savingsRate >= 20 ? 'Acima de 20% ✓' : savingsRate >= 0 ? 'Abaixo de 20%' : 'Mês no negativo'}
            tone={savingsRate >= 20 ? 'positive' : savingsRate >= 0 ? 'neutral' : 'negative'}
          />
          <div style={{ width: '1px', background: 'var(--hub-border)', height: '40px', alignSelf: 'flex-end', marginBottom: '4px' }} />
          <KpiInline
            label="Melhor mês (12m)"
            value={bestMonth ? formatMonthLabel(bestMonth.month) : '–'}
            detail={bestMonth ? formatCurrency(bestMonth.balance) : 'Sem dados'}
            tone="positive"
          />
          <KpiInline
            label="Pior mês (12m)"
            value={worstMonth ? formatMonthLabel(worstMonth.month) : '–'}
            detail={worstMonth ? formatCurrency(worstMonth.balance) : 'Sem dados'}
            tone="negative"
          />
          <div style={{ width: '1px', background: 'var(--hub-border)', height: '40px', alignSelf: 'flex-end', marginBottom: '4px' }} />
          <KpiInline
            label="Média receitas (12m)"
            value={formatCurrency(avgIncome)}
            detail={`${monthsWithData.length} meses com dados`}
          />
          <KpiInline
            label="Média despesas (12m)"
            value={formatCurrency(avgExpenses)}
            detail={
              avgExpenses > 0 && summary.expenses > 0
                ? summary.expenses > avgExpenses
                  ? `↑ ${formatCurrency(summary.expenses - avgExpenses)} acima`
                  : `↓ ${formatCurrency(avgExpenses - summary.expenses)} abaixo`
                : 'Sem histórico'
            }
            tone={summary.expenses > avgExpenses && avgExpenses > 0 ? 'negative' : 'neutral'}
          />
          <KpiInline
            label="Maior categoria"
            value={largestCategory ? largestCategory.category : '–'}
            detail={largestCategory ? formatCurrency(largestCategory.amount) : 'Sem gastos'}
          />
        </div>
      </Card>

      {/* Análise IA */}
      <AiAnalysisSection
        selectedMonth={selectedMonth}
        summary={summary}
        categoryComparison={categoryComparison}
        budgetExceededCount={budgetUsageItems.filter((b) => b.status === 'exceeded').length}
      />

      {/* Tendência — Linha SVG (12 meses) */}
      <FinanceChartCard
        title="Tendência — 12 meses"
        description="Clique na legenda para mostrar/ocultar séries. Passe o mouse sobre o gráfico para ver detalhes."
      >
        {monthlyEvolution12.length === 0 ? (
          <FinanceChartEmptyState>Sem dados históricos para exibir.</FinanceChartEmptyState>
        ) : (
          <TrendLineChart data={monthlyEvolution12} />
        )}
      </FinanceChartCard>

      {/* Taxa de poupança ao longo do tempo */}
      <FinanceChartCard
        title="Taxa de poupança mensal"
        description="Verde = mês positivo · Vermelho = mês no negativo. Linha azul = tendência."
      >
        {monthsWithData.length < 2 ? (
          <FinanceChartEmptyState>Dados insuficientes para a taxa de poupança.</FinanceChartEmptyState>
        ) : (
          <SavingsRateChart data={monthlyEvolution12} />
        )}
      </FinanceChartCard>

      {/* Distribuição por categoria (Donut interativo) */}
      <FinanceChartCard
        title="Distribuição por categoria"
        description="Clique em um segmento ou categoria para ver as transações."
      >
        {categoryExpenses.length === 0 ? (
          <FinanceChartEmptyState>Sem gastos categorizados neste mês.</FinanceChartEmptyState>
        ) : (
          <DonutCategoryChart
            items={categoryExpenses.map((item) => ({
              category: item.category,
              amount: item.amount,
              transactionsCount: item.transactionsCount,
              href: withMonthAndCategoryParams('/financeiro/transacoes', selectedMonth, item.category),
            }))}
            selectedMonth={selectedMonth}
          />
        )}
      </FinanceChartCard>

      <FinanceChartCard
        title="Categorias do mês"
        description="Gastos líquidos por categoria."
      >
        <CategoryBarChart
          items={categoryExpenses.map((item) => ({
            amount: item.amount,
            category: item.category,
            href: withMonthAndCategoryParams('/financeiro/transacoes', selectedMonth, item.category),
            transactionsCount: item.transactionsCount,
          }))}
        />
      </FinanceChartCard>

      {/* Gastos por dia da semana */}
      <FinanceChartCard
        title="Gastos por dia da semana"
        description={`Despesas e compras de cartão em ${formatMonthLabel(selectedMonth)} agrupadas por dia.`}
      >
        <WeekdayChart transactions={monthlyTransactions} />
      </FinanceChartCard>

      {/* Comparação com mês anterior */}
      <Card className="mb-5">
        <div style={{ marginBottom: '20px' }}>
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
            Comparação com mês anterior
          </p>
          <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
            {formatMonthLabel(monthlyComparison.currentMonth)} vs {formatMonthLabel(monthlyComparison.previousMonth)}
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          <ComparisonRow label="Receitas reais" delta={monthlyComparison.deltas.income} />
          <ComparisonRow label="Despesas reais" delta={monthlyComparison.deltas.expenses} invertColor />
          <ComparisonRow label="Resultado real" delta={monthlyComparison.deltas.balance} />
          <ComparisonRow label="Compras no cartão" delta={monthlyComparison.deltas.cardPurchases} invertColor />
        </div>
      </Card>

      {/* Categorias que mais mudaram */}
      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}>
          Categorias que mais mudaram
        </p>
        <div>
          {categoryComparison.slice(0, 5).map((item, i, arr) => (
            <div
              key={item.category}
              className="flex items-center justify-between"
              style={{ paddingBottom: '10px', marginBottom: i === arr.length - 1 ? 0 : '10px', borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <span style={{ fontSize: '13px', color: 'var(--hub-text-body)' }}>{item.category}</span>
              <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: item.difference >= 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}>
                {formatCurrency(item.difference)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {budgetUsageItems.length > 0 && (
        <FinanceChartCard
          title="Orçamentos do mês"
          description="Uso dos limites ativos. Clique em Abrir orçamentos para gerenciar."
          action={
            <a className="text-xs font-semibold transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }} href={withMonthParam('/financeiro/orcamentos', selectedMonth)}>
              Gerenciar →
            </a>
          }
        >
          <BudgetUsageChart items={budgetUsageItems} />
        </FinanceChartCard>
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────

function KpiInline({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const valueColor = {
    neutral:  'var(--hub-text)',
    positive: 'var(--hub-positive)',
    negative: 'var(--hub-negative)',
  }[tone];

  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
        {label}
      </p>
      <p className="tabular-nums" style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.02em', color: valueColor }}>
        {value}
      </p>
      <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '2px' }}>{detail}</p>
    </div>
  );
}

type Delta = { currentValue: number; previousValue: number; difference: number; percentChange?: number | null };

function ComparisonRow({ label, delta, invertColor }: { label: string; delta: Delta; invertColor?: boolean }) {
  const up = delta.difference > 0;
  const good = invertColor ? !up : up;
  const diffColor = delta.difference === 0
    ? 'var(--hub-subtle)'
    : good ? 'var(--hub-positive)' : 'var(--hub-negative)';
  const icon = delta.difference === 0 ? '→' : delta.difference > 0 ? '↑' : '↓';

  return (
    <div style={{ paddingBottom: '14px', marginBottom: '14px', borderBottom: '1px solid var(--hub-border)' }}>
      <p style={{ fontSize: '10px', color: 'var(--hub-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
        {label}
      </p>
      <p className="tabular-nums" style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
        {formatCurrency(delta.currentValue)}
      </p>
      <p style={{ fontSize: '11px', color: diffColor, marginTop: '2px' }}>
        {icon} {delta.difference === 0
          ? 'Sem alteração'
          : `${formatCurrency(Math.abs(delta.difference))}${
              delta.percentChange != null ? ` (${formatPercentage(Math.abs(delta.percentChange))})` : ''
            }`}
        <span style={{ color: 'var(--hub-disabled)', marginLeft: '8px' }}>
          ant. {formatCurrency(delta.previousValue)}
        </span>
      </p>
    </div>
  );
}
