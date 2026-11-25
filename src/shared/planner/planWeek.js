/**
 * planWeek.js — which Monday a weekly plan belongs to.
 *
 * One file for the app and the server (plain JS + .d.ts, like financeMonth.js).
 * Each side used to carry its own copy, and both formatted the date with
 * `toISOString()`, which is UTC: after 21h in Brazil the Monday came out as
 * Tuesday, so a plan generated on Monday night was "for" a week that doesn't
 * exist and the app kept saying there was no plan. Dates here are local.
 */

import { localDayKey } from '../dates/localDay.js';

/** Monday of the week `date` is in (a Sunday belongs to the week that ends on it). */
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return localDayKey(d);
}

/** The Monday after `date`. */
export function nextMondayFrom(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
  return localDayKey(d);
}

/**
 * The week a plan made now is for: on Sunday it's the coming week (the
 * scheduled job runs Sunday night), any other day the current one.
 */
export function targetWeekOf(date = new Date()) {
  return new Date(date).getDay() === 0 ? nextMondayFrom(date) : mondayOf(date);
}
