// Types for financeMonth.js (plain JS so the server can import it too).

export const DEFAULT_MONTH_START_DAY: number;
export const MONTH_START_DAY_KEY: string;

export function clampStartDay(value: unknown): number;
export function financialMonthRange(monthKey: string, startDay?: number): { start: string; end: string };
export function financialMonthOf(date: string, startDay?: number): string;
export function isInFinancialMonth(date: string | null | undefined, monthKey: string, startDay?: number): boolean;
export function currentFinancialMonth(startDay?: number, now?: Date): string;
