import { storageAdapter } from '../../../../core/storage/storage.adapter';
import { financeSummaryService } from '../../services/financeSummaryService';
import { type Investment } from '../types/investment';

const KEY_RESERVE_TARGET_MONTHS = 'finance.investments.reserveTargetMonths';
const KEY_RESERVE_DEADLINE = 'finance.investments.reserveDeadline';

/** Faixa usual de reserva de emergência; ponto de partida, não recomendação. */
const DEFAULT_TARGET_MONTHS = 6;

/** Janela de meses olhada pra estimar o custo de vida. */
const LOOKBACK_MONTHS = 6;

export type ReserveStatus = {
  currentValue: number;
  /** Gasto mensal médio real, ignorando meses sem lançamento. */
  monthlyExpenseAverage: number;
  /** Quantos meses de gasto a reserva cobre hoje. Null sem histórico. */
  monthsCovered: number | null;
  targetMonths: number;
  /** Meta em reais — consequência do gasto, não um número escolhido a dedo. */
  targetValue: number | null;
  /** Quanto falta pra meta. Negativo = passou. */
  gap: number | null;
  /** Meses com lançamento usados na média — mostra o quanto confiar no número. */
  monthsSampled: number;
};

export function getReserveTargetMonths(): number {
  return storageAdapter.getItem<number>(KEY_RESERVE_TARGET_MONTHS) ?? DEFAULT_TARGET_MONTHS;
}

export function setReserveTargetMonths(months: number): number {
  const safe = Math.max(1, Math.round(months));
  storageAdapter.setItem(KEY_RESERVE_TARGET_MONTHS, safe);
  return safe;
}

/**
 * Prazo (data-alvo) pra reserva estar pronta. Ausente = usuário não decidiu
 * um prazo ainda — nesse caso o aporte mensal inteiro segue pra carteira,
 * como sempre foi, e a reserva só cresce por aporte manual.
 */
export function getReserveDeadline(): string | null {
  return storageAdapter.getItem<string>(KEY_RESERVE_DEADLINE) ?? null;
}

export function setReserveDeadline(date: string | null): void {
  if (date) storageAdapter.setItem(KEY_RESERVE_DEADLINE, date);
  else storageAdapter.removeItem(KEY_RESERVE_DEADLINE);
}

/**
 * Gasto mensal médio real dos últimos meses.
 *
 * Usa `expenses` do resumo mensal (gasto líquido, já sem transferência,
 * pagamento de fatura e reembolso pareado) — é o custo de vida, que é o que a
 * reserva precisa cobrir. Meses sem nenhum lançamento ficam de fora da média:
 * contá-los como R$0 puxaria o custo de vida pra baixo e faria a reserva
 * parecer maior do que é.
 */
export function calculateMonthlyExpenseAverage(): { average: number; monthsSampled: number } {
  const evolution = financeSummaryService.getMonthlyEvolution(undefined, LOOKBACK_MONTHS);
  const monthsWithData = evolution.filter((point) => point.transactionCount > 0 && point.expenses > 0);

  if (monthsWithData.length === 0) {
    return { average: 0, monthsSampled: 0 };
  }

  const total = monthsWithData.reduce((sum, point) => sum + point.expenses, 0);
  return { average: total / monthsWithData.length, monthsSampled: monthsWithData.length };
}

/**
 * Mede a reserva em meses de gasto, não em reais.
 *
 * "R$30 mil" é um número escolhido; quantos meses ele cobre depende do custo de
 * vida e muda sozinho quando o gasto muda. Medir em meses mantém a meta honesta
 * sem precisar revisar o valor à mão.
 */
export function calculateReserveStatus(investments: Investment[]): ReserveStatus {
  const currentValue = investments
    .filter((investment) => investment.bucket === 'reserva')
    .reduce((sum, investment) => sum + investment.currentValue, 0);

  const { average, monthsSampled } = calculateMonthlyExpenseAverage();
  const targetMonths = getReserveTargetMonths();
  const hasExpenseData = average > 0;

  return {
    currentValue,
    monthlyExpenseAverage: average,
    monthsCovered: hasExpenseData ? currentValue / average : null,
    targetMonths,
    targetValue: hasExpenseData ? average * targetMonths : null,
    gap: hasExpenseData ? average * targetMonths - currentValue : null,
    monthsSampled,
  };
}

export const reserveService = {
  getReserveTargetMonths,
  setReserveTargetMonths,
  getReserveDeadline,
  setReserveDeadline,
  calculateMonthlyExpenseAverage,
  calculateReserveStatus,
};
