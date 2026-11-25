/**
 * recentActivity.js — "only nag about what the person is actually doing".
 *
 * A reminder about a habit someone dropped months ago isn't a reminder, it's
 * noise ("você não treina há 96 dias", twice a day). Every habit nudge — the
 * push, the Home's alerts — asks these first, so the push and the screen never
 * disagree about whether you're still in the game. Plain JS + .d.ts: the app,
 * the server and the scheduled scripts all import this one file.
 */

import { localDayKey } from '../dates/localDay.js';

/** A study plan counts as followed if any session was marked in this window. */
export const STUDY_ACTIVE_DAYS = 14;
/** A training habit counts as alive if the last workout is this recent. */
export const FITNESS_ACTIVE_DAYS = 21;

/**
 * Whether the weekly plan is being followed: some session marked done or
 * partial recently. `completions` is `study.sessionCompletions`
 * (`"<weekOf>:<index>" → status`); weekOf is a Monday and a mark can come up to
 * six days after it, hence the slack.
 */
export function isStudyPlanInUse(completions, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - STUDY_ACTIVE_DAYS - 6);
  const cutoffKey = localDayKey(cutoff);
  return Object.entries(completions ?? {}).some(
    ([key, status]) => (status === 'done' || status === 'partial') && key.split(':')[0] >= cutoffKey,
  );
}

/** Whether a "you haven't trained in N days" nudge still means something. */
export function isTrainingInUse(daysSinceLastWorkout) {
  return daysSinceLastWorkout !== null && daysSinceLastWorkout <= FITNESS_ACTIVE_DAYS;
}
