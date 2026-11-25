import { collegeAlertProvider } from '../../modules/college/alerts/collegeAlertProvider';
import { financeAlertProvider } from '../../modules/finance/alerts/financeAlertProvider';
import { fitnessAlertProvider } from '../../modules/fitness/alerts/fitnessAlertProvider';
import { goalAlertProvider } from '../../modules/goals/alerts/goalAlertProvider';
import { plannerAlertProvider } from '../../modules/planner/alerts/plannerAlertProvider';
import { projectAlertProvider } from '../../modules/projects/alerts/projectAlertProvider';
import { studyAlertProvider } from '../../modules/study/alerts/studyAlertProvider';
import { systemHealthAlertProvider } from '../health/systemHealthAlertProvider';
import { type AlertProvider, type HubAlert } from './alert-types';
import { modules } from '../module-registry/modules';
import { isModuleBlocked, isModuleEnabled } from '../session/session';

const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const providers: AlertProvider[] = [systemHealthAlertProvider, financeAlertProvider, collegeAlertProvider, fitnessAlertProvider, goalAlertProvider, plannerAlertProvider, projectAlertProvider, studyAlertProvider];

const moduleIds = new Set<string>(modules.map((m) => m.id));

/**
 * Alerts of a module the user didn't choose, or one in maintenance (its action
 * would open the maintenance screen), stay quiet; non-module alerts (system
 * health) always show.
 */
function isAlertVisible(alert: HubAlert): boolean {
  if (!moduleIds.has(alert.moduleId)) return true;
  const id = alert.moduleId as (typeof modules)[number]['id'];
  return isModuleEnabled(id) && !isModuleBlocked(id);
}

export function getHubAlerts(): HubAlert[] {
  return providers
    .flatMap((p) => p.getAlerts())
    .filter(isAlertVisible)
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
}
