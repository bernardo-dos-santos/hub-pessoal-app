/**
 * The financial month — the one rule for "which month does this transaction
 * belong to". Shared by the app (TypeScript, through financeMonth.d.ts) and by
 * the server and scripts (plain Node), so the Íris, the briefing and the
 * screens never disagree about a month again. Plain JS on purpose: it is the
 * only code both runtimes can import as is.
 *
 * Each user picks the day their month starts (`finance.monthStartDay`, 1 by
 * default). Day 1 is the calendar month. Another day lines the month up with a
 * card's billing cycle (closing day + 1) or with payday.
 *
 * A month keeps its `YYYY-MM` key; the key names the calendar month holding
 * most of the period:
 *   start day 1..16  → the period starts in the named month (day 6: 6 Oct – 5 Nov is "2026-10")
 *   start day 17..31 → the period ends in the named month  (day 25: 25 Oct – 24 Nov is "2026-11")
 * Screens always show the dates next to the name, so the rule never has to be
 * guessed. A start day past the end of a short month falls on its last day.
 */

export const DEFAULT_MONTH_START_DAY = 1;
export const MONTH_START_DAY_KEY = 'finance.monthStartDay';

/** Anything → a valid start day (1–31); junk means the calendar month. */
export function clampStartDay(value) {
  const day = Math.trunc(Number(value));
  if (!Number.isFinite(day) || day < 1) return DEFAULT_MONTH_START_DAY;
  return Math.min(day, 31);
}

const pad = (n) => String(n).padStart(2, '0');
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const keyOf = (year, month) => `${year}-${pad(month)}`;

function shift(year, month, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The day this month's period starts on, for a calendar month. */
function startDayIn(year, month, startDay) {
  return Math.min(startDay, daysInMonth(year, month));
}

function parseKey(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return { year, month };
}

/**
 * First and last day (inclusive, `YYYY-MM-DD`) of the financial month `monthKey`.
 */
export function financialMonthRange(monthKey, startDay = DEFAULT_MONTH_START_DAY) {
  const day = clampStartDay(startDay);
  const named = parseKey(monthKey);
  // The calendar month the period starts in.
  const anchor = day <= 16 ? named : shift(named.year, named.month, -1);
  const next = shift(anchor.year, anchor.month, 1);

  const startDate = startDayIn(anchor.year, anchor.month, day);
  const nextStart = startDayIn(next.year, next.month, day);

  // The period ends the day before the next one starts.
  const end = nextStart > 1
    ? `${keyOf(next.year, next.month)}-${pad(nextStart - 1)}`
    : `${keyOf(anchor.year, anchor.month)}-${pad(daysInMonth(anchor.year, anchor.month))}`;

  return { start: `${keyOf(anchor.year, anchor.month)}-${pad(startDate)}`, end };
}

/** The financial month (`YYYY-MM`) a date (`YYYY-MM-DD…`) belongs to. */
export function financialMonthOf(date, startDay = DEFAULT_MONTH_START_DAY) {
  const day = clampStartDay(startDay);
  const [year, month, dayOfMonth] = String(date).slice(0, 10).split('-').map(Number);
  const anchor = dayOfMonth >= startDayIn(year, month, day) ? { year, month } : shift(year, month, -1);
  const named = day <= 16 ? anchor : shift(anchor.year, anchor.month, 1);
  return keyOf(named.year, named.month);
}

export function isInFinancialMonth(date, monthKey, startDay = DEFAULT_MONTH_START_DAY) {
  return Boolean(date) && financialMonthOf(date, startDay) === monthKey;
}

/** The financial month of a moment (today by default), in local time. */
export function currentFinancialMonth(startDay = DEFAULT_MONTH_START_DAY, now = new Date()) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return financialMonthOf(today, startDay);
}
