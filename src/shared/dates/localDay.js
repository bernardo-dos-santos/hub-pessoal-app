/**
 * localDay.js — the calendar day a moment falls on, where the person is.
 *
 * `toISOString().slice(0, 10)` is the day in UTC: in Brazil, from 21h on it is
 * already tomorrow. That was 30-odd call sites (the study streak, check-ins,
 * "today's" workout, the plan's Monday...), each one wrong for three hours a
 * night. Plain JS + .d.ts so the app, the server and the scripts share it.
 *
 * Only for "what day is it / was it" on a Date. Arithmetic on a YYYY-MM-DD
 * string done entirely in UTC (`T00:00:00Z` + setUTCDate) is fine as it is.
 */
export function localDayKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
