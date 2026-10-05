import { useState } from 'react';
import { ModuleHeader, Card, Select } from '../../../../shared/ui';
import { getFinanceTabs } from '../../components/financeTabs';
import { investmentService, type InvestmentInput } from '../services/investmentService';
import { syncInvestmentsFromPluggy, type PluggyInvestmentSyncResult } from '../services/pluggyInvestmentSyncService';
import { allocationService } from '../services/allocationService';
import { reserveService } from '../services/reserveService';
import { contributionPlanService } from '../services/contributionPlanService';
import { treasuryProjectionService } from '../services/treasuryProjectionService';
import { aiInvestmentAnalysisService, type InvestmentAnalysis } from '../services/aiInvestmentAnalysisService';
import { investmentMovementService } from '../services/investmentMovementService';
import { MOVEMENT_TYPE_LABEL, type InvestmentMovementType } from '../types/movement';
import { transactionService } from '../../services/transactionService';
import {
  type AllocationSleeve,
  type AssetCurrency,
  type Investment,
  type InvestmentAssetType,
  type InvestmentBucket,
  ASSET_TYPE_LABEL,
  BUCKET_LABEL,
  SLEEVE_LABEL,
} from '../types/investment';
import { formatCurrency } from '../../utils/financeFormatters';
import { formatMonthLabel, getCurrentMonthKey } from '../../utils/financePeriod';

const ASSET_TYPES = Object.entries(ASSET_TYPE_LABEL) as [InvestmentAssetType, string][];
const BUCKETS = Object.entries(BUCKET_LABEL) as [InvestmentBucket, string][];
const SLEEVES = Object.entries(SLEEVE_LABEL) as [AllocationSleeve, string][];

const typeColor: Record<InvestmentAssetType, string> = {
  fixed_income: 'var(--hub-accent)',
  stock:        'var(--hub-mauve)',
  fund:         'var(--hub-warning)',
  treasury:     'var(--hub-positive)',
  crypto:       'var(--hub-progress)',
  other:        'var(--hub-subtle)',
};

function formatPct(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none';
const selectClass = 'w-full bg-transparent pb-1.5 text-sm outline-none cursor-pointer appearance-none';

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
};

type FormState = Omit<
  InvestmentInput,
  'currentValue' | 'totalInvested' | 'bucket' | 'sleeve' | 'currency' | 'contractedRate'
> & {
  currentValue: string;
  totalInvested: string;
  bucket: InvestmentBucket;
  sleeve: AllocationSleeve;
  currency: AssetCurrency;
  contractedRate: string;
};

const emptyForm = (): FormState => ({
  name: '',
  type: 'fixed_income',
  institution: '',
  currentValue: '',
  totalInvested: '',
  notes: '',
  bucket: 'carteira',
  sleeve: 'acoes_br',
  currency: 'BRL',
  maturityDate: '',
  contractedRate: '',
});

type PluggySyncState = 'idle' | 'loading' | 'done' | 'empty' | 'error';

export function InvestmentsPlanningPage() {
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;
  const [investments, setInvestments] = useState(() => investmentService.listInvestments());
  const [goal, setGoal] = useState(() => investmentService.getMonthlyGoal());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [goalInput, setGoalInput] = useState(goal ? String(goal.targetAmount) : '');
  const [editingGoal, setEditingGoal] = useState(false);
  const [pluggySyncState, setPluggySyncState] = useState<PluggySyncState>('idle');
  const [pluggySyncResult, setPluggySyncResult] = useState<PluggyInvestmentSyncResult | null>(null);
  const currentMonth = getCurrentMonthKey();
  const [analysis, setAnalysis] = useState<InvestmentAnalysis | null>(
    () => aiInvestmentAnalysisService.getCachedAnalysis(currentMonth),
  );
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const totals = investmentService.getTotals();
  const bucketTotals = investmentService.getTotalsByBucket();
  const allocation = allocationService.calculateAllocation(investments);
  const reserve = reserveService.calculateReserveStatus(investments);
  const plan = contributionPlanService.suggestContributionPlan(investments, goal?.targetAmount ?? 0);
  const nextContribution = plan.portfolioSuggestion;
  const [reserveMonthsInput, setReserveMonthsInput] = useState(String(reserve.targetMonths));
  const [editingReserve, setEditingReserve] = useState(false);
  const [reserveDeadline, setReserveDeadlineState] = useState(() => reserveService.getReserveDeadline());
  const [deadlineInput, setDeadlineInput] = useState(reserveDeadline ?? '');
  const [editingDeadline, setEditingDeadline] = useState(false);

  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(allocationService.getTargetAllocation()).map(([k, v]) => [k, String(v)])),
  );

  const targetDraftTotal = Object.values(targetDraft).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

  function saveTargetAllocation() {
    const parsed = Object.fromEntries(
      Object.entries(targetDraft).map(([key, value]) => [key, parseFloat(value) || 0]),
    ) as Record<AllocationSleeve, number>;

    // Alvo que não soma 100% faria toda a comparação alvo × real mentir.
    if (!allocationService.isTargetComplete(parsed)) return;

    allocationService.setTargetAllocation(parsed);
    setEditingTarget(false);
    refresh();
  }

  const [movementsFor, setMovementsFor] = useState<Investment | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: 'contribution' as InvestmentMovementType,
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    exchangeRate: '',
    note: '',
  });

  function openMovements(investment: Investment) {
    setMovementsFor(investment);
    setMovementForm({
      type: 'contribution',
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      exchangeRate: '',
      note: '',
    });
  }

  function handleSaveMovement() {
    if (!movementsFor) return;
    const amount = parseFloat(movementForm.amount);
    if (!amount || amount <= 0) return;

    const isForeign = (movementsFor.currency ?? 'BRL') !== 'BRL';
    const exchangeRate = parseFloat(movementForm.exchangeRate);
    // Ativo em moeda estrangeira sem câmbio informado não pode ser convertido —
    // gravar sem a cotação do dia deixaria o histórico em real errado pra sempre.
    if (isForeign && (!exchangeRate || exchangeRate <= 0)) return;

    investmentService.addMovement({
      investmentId: movementsFor.id,
      type: movementForm.type,
      date: movementForm.date,
      amount,
      exchangeRate: isForeign ? exchangeRate : undefined,
      note: movementForm.note.trim() || undefined,
      source: 'manual',
    });

    setMovementForm((f) => ({ ...f, amount: '', exchangeRate: '', note: '' }));
    const updated = investmentService.getById(movementsFor.id);
    setMovementsFor(updated);
    refresh();
  }

  function saveReserveTarget() {
    const months = parseInt(reserveMonthsInput, 10);
    if (!months || months <= 0) return;
    reserveService.setReserveTargetMonths(months);
    setEditingReserve(false);
    refresh();
  }

  function saveReserveDeadline() {
    // Vazio é uma escolha válida: volta pro comportamento sem prazo (aporte
    // inteiro pra carteira), não um valor pra rejeitar.
    const date = deadlineInput || null;
    reserveService.setReserveDeadline(date);
    setReserveDeadlineState(date);
    setEditingDeadline(false);
  }

  function refresh() {
    setInvestments(investmentService.listInvestments());
    setGoal(investmentService.getMonthlyGoal());
  }

  async function handleAnalyze() {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const result = await aiInvestmentAnalysisService.analyzeMonth(
        currentMonth,
        totals,
        bucketTotals,
        reserve,
        allocation,
        plan.split,
        goal?.targetAmount ?? null,
      );
      setAnalysis(result);
    } catch {
      setAnalysisError('Falha ao gerar resumo. Verifique a chave de IA nas configurações.');
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleSyncPluggy() {
    setPluggySyncState('loading');
    try {
      const result = await syncInvestmentsFromPluggy();
      setPluggySyncResult(result);
      setPluggySyncState(result.total === 0 ? 'empty' : 'done');
      refresh();
    } catch {
      setPluggySyncState('error');
    }
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(inv: Investment) {
    setEditId(inv.id);
    setForm({
      name: inv.name,
      type: inv.type,
      institution: inv.institution,
      currentValue: String(inv.currentValue),
      totalInvested: String(inv.totalInvested),
      notes: inv.notes ?? '',
      bucket: inv.bucket ?? 'carteira',
      sleeve: inv.sleeve ?? 'acoes_br',
      currency: inv.currency ?? 'BRL',
      maturityDate: inv.maturityDate ?? '',
      contractedRate: inv.contractedRate !== undefined ? String(inv.contractedRate) : '',
    });
    setShowForm(true);
  }

  function handleSave() {
    const input: InvestmentInput = {
      name:          form.name.trim(),
      type:          form.type,
      institution:   form.institution.trim(),
      currentValue:  parseFloat(form.currentValue) || 0,
      totalInvested: parseFloat(form.totalInvested) || 0,
      notes:         form.notes?.trim() || undefined,
      bucket:        form.bucket,
      // Fatia só faz sentido na carteira — reserva não entra na alocação alvo.
      sleeve:        form.bucket === 'carteira' ? form.sleeve : undefined,
      currency:      form.currency,
      // Só fazem sentido pra Tesouro com taxa contratada (ex.: IPCA+ 2045).
      maturityDate:     form.type === 'treasury' && form.maturityDate ? form.maturityDate : undefined,
      contractedRate:   form.type === 'treasury' && form.contractedRate ? parseFloat(form.contractedRate) || undefined : undefined,
    };
    if (!input.name) return;
    if (editId) investmentService.update(editId, input);
    else investmentService.create(input);
    setShowForm(false);
    refresh();
  }

  function handleDelete(id: string) {
    investmentService.delete(id);
    refresh();
  }

  function saveGoal() {
    const amount = parseFloat(goalInput);
    if (!amount || amount <= 0) return;
    investmentService.setMonthlyGoal({ targetAmount: amount });
    setGoal({ targetAmount: amount });
    setEditingGoal(false);
  }

  const rendColor = totals.rendimento >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)';

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Investimentos" tabs={getFinanceTabs(pendingReviewCount)} />

      <Card className="mb-5">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <InlineStat label="Patrimônio" value={formatCurrency(totals.patrimonio)} />
          <InlineStat label="Total investido" value={formatCurrency(totals.investido)} />
          <InlineStat label="Rendimento" value={formatCurrency(totals.rendimento)} color={rendColor} />
          <InlineStat label="Rentabilidade" value={formatPct(totals.rentabilidade)} color={rendColor} />
        </div>
        <div
          className="mt-4 flex flex-wrap gap-x-8 gap-y-3"
          style={{ paddingTop: '14px', borderTop: '1px solid var(--hub-border)' }}
        >
          <InlineStat label="Reserva" value={formatCurrency(bucketTotals.reserva)} small />
          <InlineStat label="Carteira" value={formatCurrency(bucketTotals.carteira)} small />
        </div>
      </Card>

      {/* Reserva medida em meses de gasto */}
      <Card className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
              Reserva de emergência
            </p>
            {reserve.monthsCovered === null ? (
              <p className="text-sm" style={{ color: 'var(--hub-disabled)' }}>
                Sem gasto registrado ainda — importe transações pra medir a reserva em meses.
              </p>
            ) : (
              <>
                <p className="tabular-nums" style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)' }}>
                  {reserve.monthsCovered.toFixed(1)} meses{' '}
                  <span style={{ fontSize: '13px', color: 'var(--hub-subtle)' }}>
                    de {reserve.targetMonths}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                  {formatCurrency(reserve.currentValue)} guardados · gasto médio{' '}
                  {formatCurrency(reserve.monthlyExpenseAverage)}/mês
                  {reserve.monthsSampled > 0 && ` (${reserve.monthsSampled} ${reserve.monthsSampled === 1 ? 'mês' : 'meses'})`}
                </p>
              </>
            )}
          </div>
          {editingReserve ? (
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={reserveMonthsInput}
                onChange={(e) => setReserveMonthsInput(e.target.value)}
                className="w-16 bg-transparent pb-1 text-sm outline-none"
                aria-label="Meta em meses"
              />
              <button
                onClick={saveReserveTarget}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Salvar
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setReserveMonthsInput(String(reserve.targetMonths)); setEditingReserve(true); }}
              className="shrink-0 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Meta: {reserve.targetMonths} meses
            </button>
          )}
        </div>

        {reserve.targetValue !== null && reserve.gap !== null && (
          <p className="mt-3 text-xs leading-5" style={{ color: reserve.gap > 0 ? 'var(--hub-warning)' : 'var(--hub-positive)' }}>
            {reserve.gap > 0
              ? `Faltam ${formatCurrency(reserve.gap)} pra fechar ${reserve.targetMonths} meses (${formatCurrency(reserve.targetValue)}).`
              : `Reserva completa — ${formatCurrency(Math.abs(reserve.gap))} acima da meta.`}
          </p>
        )}

        <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
          A meta é medida em meses, não em reais: o valor em reais se recalcula sozinho quando seu gasto muda.
        </p>

        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--hub-border)' }}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Prazo pra reserva ficar pronta — divide o aporte mensal sozinho quando definido.
            </p>
            {editingDeadline ? (
              <div className="flex shrink-0 items-center gap-3">
                <input
                  type="date"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="bg-transparent pb-1 text-sm outline-none"
                  aria-label="Prazo pra reserva"
                />
                <button
                  onClick={saveReserveDeadline}
                  className="text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Salvar
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setDeadlineInput(reserveDeadline ?? ''); setEditingDeadline(true); }}
                className="shrink-0 text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {reserveDeadline ? `Prazo: ${reserveDeadline.slice(0, 7)}` : 'Definir prazo'}
              </button>
            )}
          </div>

          {plan.split.deadlineActive && (
            <p
              className="mt-3 text-xs leading-5"
              style={{ color: plan.split.feasible ? 'var(--hub-subtle)' : 'var(--hub-warning)' }}
            >
              {plan.split.feasible
                ? `No aporte de ${formatCurrency(plan.split.totalAmount)}, ${formatCurrency(plan.split.reserveAmount)} vai pra reserva e ${formatCurrency(plan.split.portfolioAmount)} pra carteira — fecha em ${plan.split.monthsToDeadline} meses.`
                : `Nem mandando o aporte inteiro (${formatCurrency(plan.split.totalAmount)}) pra reserva dá pra fechar em ${plan.split.monthsToDeadline} meses — faltariam ${formatCurrency(plan.split.shortfallPerMonth ?? 0)}/mês. Aumente o aporte ou estenda o prazo.`}
            </p>
          )}
          {!plan.split.deadlineActive && plan.split.reserveComplete && reserveDeadline && (
            <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-positive)' }}>
              Reserva completa — o aporte inteiro segue pra carteira.
            </p>
          )}
        </div>
      </Card>

      {/* Alocação alvo × real */}
      <Card className="mb-5">
        <div className="flex items-start justify-between gap-4" style={{ marginBottom: '4px' }}>
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Alocação da carteira
          </p>
          <button
            onClick={() => {
              setTargetDraft(
                Object.fromEntries(
                  Object.entries(allocationService.getTargetAllocation()).map(([k, v]) => [k, String(v)]),
                ),
              );
              setEditingTarget((v) => !v);
            }}
            className="shrink-0 text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {editingTarget ? 'cancelar' : 'ajustar alvo'}
          </button>
        </div>
        <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)', marginBottom: '16px' }}>
          Só a carteira entra nesta conta — a reserva tem função própria e fica de fora.
        </p>

        {editingTarget && (
          <div
            className="mb-4"
            style={{ padding: '14px', borderRadius: '10px', background: 'var(--hub-surface-muted)' }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {SLEEVES.map(([sleeve, label]) => (
                <label key={sleeve} className="flex items-center justify-between gap-3">
                  <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>{label}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      value={targetDraft[sleeve] ?? '0'}
                      onChange={(e) => setTargetDraft((d) => ({ ...d, [sleeve]: e.target.value }))}
                      className="w-14 bg-transparent pb-1 text-right text-sm outline-none"
                    />
                    <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>%</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span
                className="text-xs tabular-nums"
                style={{ color: Math.abs(targetDraftTotal - 100) < 0.01 ? 'var(--hub-positive)' : 'var(--hub-negative)' }}
              >
                Soma: {targetDraftTotal.toFixed(0)}%{Math.abs(targetDraftTotal - 100) >= 0.01 && ' — precisa fechar 100%'}
              </span>
              <button
                onClick={saveTargetAllocation}
                disabled={Math.abs(targetDraftTotal - 100) >= 0.01}
                className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Salvar alvo
              </button>
            </div>
          </div>
        )}

        {nextContribution && (
          <div
            className="mb-4"
            style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--hub-surface-muted)' }}
          >
            <p style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
              Próximo aporte {plan.split.deadlineActive && '· parte da carteira'}
            </p>
            {plan.split.deadlineActive && plan.split.reserveAmount > 0 && (
              <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)', marginBottom: '6px' }}>
                {formatCurrency(plan.split.reserveAmount)} do aporte já foi reservado pro prazo da reserva —
                o resto é o que sobra pra carteira.
              </p>
            )}
            <p className="text-sm" style={{ color: 'var(--hub-text)' }}>
              <strong style={{ color: 'var(--hub-accent)', fontWeight: 500 }}>
                {formatCurrency(nextContribution.amount)} → {nextContribution.label}
              </strong>
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
              {nextContribution.reason} Um destino por mês rende mais que dividir o aporte em quatro.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {allocation.sleeves.map((sleeve) => (
            <div key={sleeve.sleeve}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--hub-text)' }}>{sleeve.label}</span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                  {sleeve.currentPercent.toFixed(1)}% de {sleeve.targetPercent}%
                  {' · '}
                  {formatCurrency(sleeve.currentValue)}
                </span>
              </div>
              <div style={{ marginTop: '6px', height: '4px', borderRadius: '999px', background: 'var(--hub-surface-muted)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, sleeve.targetPercent > 0 ? (sleeve.currentPercent / sleeve.targetPercent) * 100 : 0)}%`,
                    height: '100%',
                    background: 'var(--hub-accent)',
                    borderRadius: '999px',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {allocation.unassignedValue > 0 && (
          <p className="mt-4 text-xs" style={{ color: 'var(--hub-warning)' }}>
            {formatCurrency(allocation.unassignedValue)} em carteira sem fatia definida — edite o ativo pra classificar.
          </p>
        )}
      </Card>

      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '10px' }}>
          Pluggy · Open Finance
        </p>
        <p className="text-sm" style={{ color: 'var(--hub-muted)', marginBottom: '14px' }}>
          Sincroniza posições de corretoras conectadas via Open Finance. Investimentos manuais não são afetados;
          posições já sincronizadas são atualizadas, nunca duplicadas.
        </p>
        <button
          onClick={handleSyncPluggy}
          disabled={pluggySyncState === 'loading'}
          className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {pluggySyncState === 'loading' ? 'Sincronizando…' : 'Sincronizar com Pluggy'}
        </button>
        {pluggySyncState === 'done' && pluggySyncResult && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-positive)' }}>
            ✓ {pluggySyncResult.created} nova(s), {pluggySyncResult.valuationsRecorded} marcação(ões) registrada(s)
            {pluggySyncResult.unchanged > 0 && `, ${pluggySyncResult.unchanged} sem mudança`}.
          </p>
        )}
        {pluggySyncState === 'empty' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>
            Nenhuma posição de investimento encontrada nas conexões atuais.
          </p>
        )}
        {pluggySyncState === 'error' && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>
            ✗ Erro ao buscar dados da Pluggy.
          </p>
        )}
      </Card>

      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '10px' }}>
          Meta de aporte mensal
        </p>
        {editingGoal ? (
          <div className="flex items-center gap-4">
            <input
              type="number"
              placeholder="ex: 500"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="w-32 bg-transparent pb-1 text-sm outline-none"
            />
            <button
              onClick={saveGoal}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Salvar
            </button>
            <button
              onClick={() => setEditingGoal(false)}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-baseline gap-4">
            <p style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '-0.02em', color: goal ? 'var(--hub-text)' : 'var(--hub-disabled)' }}>
              {goal ? formatCurrency(goal.targetAmount) : 'Não definida'}
            </p>
            <button
              onClick={() => { setGoalInput(goal ? String(goal.targetAmount) : ''); setEditingGoal(true); }}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {goal ? 'Alterar' : 'Definir'}
            </button>
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <div className="flex items-baseline justify-between gap-4" style={{ marginBottom: '10px' }}>
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Resumo do mês (IA)
          </p>
        </div>
        <p className="text-sm" style={{ color: 'var(--hub-muted)', marginBottom: '14px' }}>
          Análise consultiva sobre o seu plano — fatias, prazo da reserva, ritmo de aporte. Nunca opina sobre
          mercado ou sobre comprar/vender um ativo.
        </p>
        <button
          disabled={analysisLoading}
          onClick={handleAnalyze}
          className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {analysisLoading
            ? 'Analisando…'
            : analysis && analysis.month === currentMonth
              ? `✨ Reanalisar ${formatMonthLabel(currentMonth)}`
              : `✨ Analisar ${formatMonthLabel(currentMonth)}`}
        </button>

        {analysisError && (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>{analysisError}</p>
        )}

        {analysis && analysis.month === currentMonth && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <p className="text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{analysis.insight}</p>

            {analysis.positives.length > 0 && (
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-positive)', marginBottom: '8px' }}>
                  Pontos positivos
                </p>
                <ul className="grid gap-2">
                  {analysis.positives.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-5" style={{ color: 'var(--hub-text-body)' }}>
                      <span style={{ color: 'var(--hub-positive)', flexShrink: 0 }}>✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.suggestions.length > 0 && (
              <div>
                <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-warning)', marginBottom: '8px' }}>
                  Sugestões
                </p>
                <ul className="grid gap-2">
                  {analysis.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-5" style={{ color: 'var(--hub-text-body)' }}>
                      <span style={{ color: 'var(--hub-warning)', flexShrink: 0 }}>→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p style={{ fontSize: '10px', color: 'var(--hub-disabled)' }}>
              Gerado em {new Date(analysis.generatedAt).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
          <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Carteira ({investments.length})
          </p>
          <button
            onClick={openAdd}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            + Adicionar
          </button>
        </div>

        {investments.length === 0 ? (
          <div style={{ paddingTop: '24px', paddingBottom: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--hub-subtle)' }}>Nenhum investimento cadastrado ainda.</p>
            <button
              onClick={openAdd}
              className="transition-opacity hover:opacity-70"
              style={{ display: 'inline-block', marginTop: '12px', fontSize: '13px', color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Adicionar primeiro investimento →
            </button>
          </div>
        ) : (
          <div>
            {investments.map((inv, i) => {
              const rend = inv.currentValue - inv.totalInvested;
              const pct = inv.totalInvested > 0 ? (rend / inv.totalInvested) * 100 : 0;
              const color = rend >= 0 ? 'var(--hub-positive)' : 'var(--hub-negative)';
              const projection = treasuryProjectionService.calculateContractedProjection(inv);
              return (
                <div
                  key={inv.id}
                  className="py-3"
                  style={{ borderBottom: i === investments.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: typeColor[inv.type] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{inv.name}</p>
                      <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                        {ASSET_TYPE_LABEL[inv.type]} · {inv.institution}
                        {(inv.bucket ?? 'carteira') === 'reserva'
                          ? ' · reserva'
                          : inv.sleeve
                            ? ` · ${SLEEVE_LABEL[inv.sleeve]}`
                            : ' · sem fatia'}
                        {inv.currency === 'USD' && ' · US$'}
                        {inv.source === 'pluggy' && ' · via Pluggy'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums" style={{ color: 'var(--hub-text)', fontWeight: 300 }}>
                        {formatCurrency(inv.currentValue)}
                      </p>
                      <p className="text-xs tabular-nums" style={{ color }}>{formatPct(pct)}</p>
                    </div>
                    <div className="flex shrink-0 gap-3">
                      <button
                        onClick={() => openMovements(inv)}
                        className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Movimentos
                      </button>
                      <button
                        onClick={() => openEdit(inv)}
                        className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {projection && (
                    <div
                      className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1"
                      style={{ marginLeft: '18px', paddingLeft: '2px' }}
                    >
                      <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                        Se vender hoje:{' '}
                        <span className="tabular-nums" style={{ color }}>{formatCurrency(inv.currentValue)}</span>
                      </span>
                      <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                        Contratado até {projection.maturityDate.slice(0, 4)}:{' '}
                        <span className="tabular-nums" style={{ color: 'var(--hub-positive)' }}>
                          {formatCurrency(projection.contractedValue)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Histórico e registro de movimentos */}
      {movementsFor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(58,44,34,0.35)' }}
          onClick={() => setMovementsFor(null)}
        >
          <div
            className="w-full max-w-lg p-6"
            style={{
              background: 'var(--hub-card)',
              borderRadius: 'var(--hub-radius-card)',
              boxShadow: 'var(--hub-shadow-modal)',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
              Movimentos
            </p>
            <p className="text-sm" style={{ color: 'var(--hub-text)', marginBottom: '18px' }}>{movementsFor.name}</p>

            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <Select
                    value={movementForm.type}
                    onChange={(value) => setMovementForm((f) => ({ ...f, type: value as InvestmentMovementType }))}
                    className={selectClass}
                  >
                    {(Object.entries(MOVEMENT_TYPE_LABEL) as [InvestmentMovementType, string][]).map(([value, label]) => (
                      <Select.Option key={value} value={value}>{label}</Select.Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>Data</label>
                  <input
                    type="date"
                    value={movementForm.date}
                    onChange={(e) => setMovementForm((f) => ({ ...f, date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>
                    Valor ({(movementsFor.currency ?? 'BRL') === 'USD' ? 'US$' : 'R$'})
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={movementForm.amount}
                    onChange={(e) => setMovementForm((f) => ({ ...f, amount: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                {(movementsFor.currency ?? 'BRL') === 'USD' && (
                  <div>
                    <label style={labelStyle}>Dólar no dia (R$)</label>
                    <input
                      type="number"
                      placeholder="5,42"
                      value={movementForm.exchangeRate}
                      onChange={(e) => setMovementForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Nota (opcional)</label>
                <input
                  placeholder="ex: aporte do mês"
                  value={movementForm.note}
                  onChange={(e) => setMovementForm((f) => ({ ...f, note: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            {(movementsFor.currency ?? 'BRL') === 'USD' && (
              <p className="mt-3 text-xs leading-5" style={{ color: 'var(--hub-subtle)' }}>
                O câmbio é guardado por movimento: é ele que separa depois o que o ativo rendeu do que o dólar mexeu.
              </p>
            )}

            <div className="mt-5 flex items-center gap-5">
              <button
                onClick={handleSaveMovement}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Registrar
              </button>
              <button
                onClick={() => setMovementsFor(null)}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                fechar
              </button>
            </div>

            <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--hub-border)' }}>
              <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '12px' }}>
                Histórico
              </p>
              {investmentMovementService.listByInvestment(movementsFor.id).length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--hub-disabled)' }}>Nenhum movimento ainda.</p>
              ) : (
                <div className="grid gap-0">
                  {investmentMovementService.listByInvestment(movementsFor.id).map((movement, i, arr) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between gap-3 py-2"
                      style={{ borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
                    >
                      <div className="min-w-0">
                        <p className="text-xs" style={{ color: 'var(--hub-text)' }}>
                          {MOVEMENT_TYPE_LABEL[movement.type]}
                          {movement.note && <span style={{ color: 'var(--hub-subtle)' }}> · {movement.note}</span>}
                        </p>
                        <p className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                          {movement.date}
                          {movement.exchangeRate && ` · US$ a R$ ${movement.exchangeRate.toFixed(2)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-xs tabular-nums" style={{ color: 'var(--hub-text)' }}>
                          {(movementsFor.currency ?? 'BRL') === 'USD' ? 'US$ ' : 'R$ '}
                          {movement.amount.toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            investmentMovementService.remove(movement.id);
                            investmentService.recalculateFromMovements(movementsFor.id);
                            setMovementsFor(investmentService.getById(movementsFor.id));
                            refresh();
                          }}
                          className="text-xs transition-opacity hover:opacity-70"
                          style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(58,44,34,0.35)' }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-md p-6"
            style={{
              background: 'var(--hub-card)',
              borderRadius: 'var(--hub-radius-card)',
              boxShadow: 'var(--hub-shadow-modal)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
              {editId ? 'Editar investimento' : 'Novo investimento'}
            </p>
            <div className="space-y-5">
              <div>
                <label style={labelStyle}>Nome</label>
                <input
                  placeholder="ex: Tesouro Selic 2029"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <Select
                    value={form.type}
                    onChange={(value) => setForm((f) => ({ ...f, type: value as InvestmentAssetType }))}
                    className={selectClass}
                  >
                    {ASSET_TYPES.map(([optionValue, label]) => (
                      <Select.Option key={optionValue} value={optionValue}>{label}</Select.Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>Instituição</label>
                  <input
                    placeholder="ex: Nubank, XP"
                    value={form.institution}
                    onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Valor atual (R$)</label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={form.currentValue}
                    onChange={(e) => setForm((f) => ({ ...f, currentValue: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Total investido (R$)</label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={form.totalInvested}
                    onChange={(e) => setForm((f) => ({ ...f, totalInvested: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label style={labelStyle}>Função do dinheiro</label>
                  <Select
                    value={form.bucket}
                    onChange={(value) => setForm((f) => ({ ...f, bucket: value as InvestmentBucket }))}
                    className={selectClass}
                  >
                    {BUCKETS.map(([optionValue, label]) => (
                      <Select.Option key={optionValue} value={optionValue}>{label}</Select.Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>Moeda</label>
                  <Select
                    value={form.currency}
                    onChange={(value) => setForm((f) => ({ ...f, currency: value as AssetCurrency }))}
                    className={selectClass}
                  >
                    <Select.Option value="BRL">Real (R$)</Select.Option>
                    <Select.Option value="USD">Dólar (US$)</Select.Option>
                  </Select>
                </div>
              </div>
              {form.bucket === 'carteira' && (
                <div>
                  <label style={labelStyle}>Fatia da carteira</label>
                  <Select
                    value={form.sleeve}
                    onChange={(value) => setForm((f) => ({ ...f, sleeve: value as AllocationSleeve }))}
                    className={selectClass}
                  >
                    {SLEEVES.map(([optionValue, label]) => (
                      <Select.Option key={optionValue} value={optionValue}>{label}</Select.Option>
                    ))}
                  </Select>
                </div>
              )}
              {form.type === 'treasury' && (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label style={labelStyle}>Vencimento</label>
                    <input
                      type="date"
                      value={form.maturityDate ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Taxa contratada (IPCA+ % a.a.)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="ex: 7.50"
                      value={form.contractedRate}
                      onChange={(e) => setForm((f) => ({ ...f, contractedRate: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
              {form.type === 'treasury' && form.maturityDate && form.contractedRate && (
                <p className="text-xs leading-5" style={{ color: 'var(--hub-subtle)', marginTop: '-8px' }}>
                  Com vencimento e taxa preenchidos, a carteira passa a mostrar "se vender hoje" (marcação a
                  mercado) ao lado de "contratado até o vencimento" — o segundo é o que vale se segurar até lá.
                </p>
              )}
              <div>
                <label style={labelStyle}>Notas (opcional)</label>
                <input
                  placeholder="ex: vence em 2029, 100% CDI"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-5">
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {editId ? 'Salvar alterações' : 'Adicionar'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineStat({
  label,
  value,
  color = 'var(--hub-text)',
  small = false,
}: {
  label: string;
  value: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '4px' }}>
        {label}
      </p>
      <p className="tabular-nums" style={{ fontSize: small ? '15px' : '20px', fontWeight: 300, letterSpacing: '-0.02em', color }}>
        {value}
      </p>
    </div>
  );
}
