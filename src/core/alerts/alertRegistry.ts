import { collegeAlertProvider } from '../../modules/college/alerts/collegeAlertProvider';
import { financeAlertProvider } from '../../modules/finance/alerts/financeAlertProvider';
import { fitnessAlertProvider } from '../../modules/fitness/alerts/fitnessAlertProvider';
import { goalAlertProvider } from '../../modules/goals/alerts/goalAlertProvider';
import { plannerAlertProvider } from '../../modules/planner/alerts/plannerAlertProvider';
import { projectAlertProvider } from '../../modules/projects/alerts/projectAlertProvider';
import { studyAlertProvider } from '../../modules/study/alerts/studyAlertProvider';
import { editalAlertProvider } from '../concurso/editalAlertProvider';
import { type AlertProvider, type HubAlert } from './alert-types';

const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const providers: AlertProvider[] = [editalAlertProvider, financeAlertProvider, collegeAlertProvider, fitnessAlertProvider, goalAlertProvider, plannerAlertProvider, projectAlertProvider, studyAlertProvider];

export function getHubAlerts(): HubAlert[] {
  return providers
    .flatMap((p) => p.getAlerts())
    .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));
}
