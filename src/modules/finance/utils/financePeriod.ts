import { storageAdapter } from '../../../core/storage/storage.adapter';
import {
  clampStartDay,
  currentFinancialMonth,
  financialMonthRange,
  MONTH_START_DAY_KEY,
} from '../../../shared/finance/financeMonth.js';

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function createMonthDate(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/** Calendar formatting of a Date as `YYYY-MM` — arithmetic on keys, not "which month is it". */
function monthKeyOfDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function isValidMonthKey(monthKey: string | null | undefined): monthKey is string {
  return Boolean(monthKey && monthKeyPattern.test(monthKey));
}

/** The day the user's financial month starts on (1 = calendar month). See financeMonth.js. */
export function getMonthStartDay() {
  return clampStartDay(storageAdapter.getItem<number>(MONTH_START_DAY_KEY));
}

export function setMonthStartDay(day: number) {
  storageAdapter.setItem(MONTH_START_DAY_KEY, clampStartDay(day));
}

/** The financial month a moment falls in (today by default), with the user's start day. */
export function getCurrentMonthKey(date = new Date()) {
  return currentFinancialMonth(getMonthStartDay(), date);
}

export function getPreviousMonthKey(monthKey: string) {
  const date = createMonthDate(isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey());
  date.setMonth(date.getMonth() - 1);
  return monthKeyOfDate(date);
}

export function getNextMonthKey(monthKey: string) {
  const date = createMonthDate(isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey());
  date.setMonth(date.getMonth() + 1);
  return monthKeyOfDate(date);
}

export function formatMonthLabel(monthKey: string) {
  const safeMonthKey = isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey();
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(createMonthDate(safeMonthKey));
}

const shortDay = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });

/**
 * The dates a financial month covers ("6 out. – 5 nov."), or '' when the month
 * is the calendar one — shown next to the month's name wherever it is picked.
 */
export function formatMonthRange(monthKey: string, startDay = getMonthStartDay()) {
  if (startDay === 1 || !isValidMonthKey(monthKey)) return '';
  const { start, end } = financialMonthRange(monthKey, startDay);
  const label = (iso: string) => shortDay.format(new Date(`${iso}T12:00:00`));
  return `${label(start)} – ${label(end)}`;
}

export function getMonthKeyFromQuery(monthKey: string | null | undefined) {
  return isValidMonthKey(monthKey) ? monthKey : getCurrentMonthKey();
}

export function withMonthParam(path: string, monthKey: string) {
  return withFinanceFilters(path, { month: monthKey });
}

export type FinanceUrlFilters = {
  month?: string;
  category?: string;
  view?: string;
};

export function withFinanceFilters(path: string, filters: FinanceUrlFilters) {
  const searchParams = new URLSearchParams();

  if (filters.month) {
    searchParams.set('month', isValidMonthKey(filters.month) ? filters.month : getCurrentMonthKey());
  }

  if (filters.category?.trim()) {
    searchParams.set('category', filters.category.trim());
  }

  if (filters.view?.trim()) {
    searchParams.set('view', filters.view.trim());
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function withReimbursementsParams(monthKey: string) {
  return withFinanceFilters('/financeiro/gastos', { month: monthKey, view: 'reembolsos' });
}

export function withMonthAndCategoryParams(path: string, monthKey: string, category?: string) {
  return withFinanceFilters(path, { month: monthKey, category });
}

export function withoutFinanceFilter(path: string, filters: FinanceUrlFilters, filter: keyof FinanceUrlFilters) {
  const nextFilters = { ...filters };
  delete nextFilters[filter];
  return withFinanceFilters(path, nextFilters);
}

export function clearFinanceFilters(path: string) {
  return withFinanceFilters(path, {});
}
