import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { isTrainingInUse } from '../../../shared/activity/recentActivity';
import { fitnessStatisticsService } from '../services/fitnessStatisticsService';

export const fitnessAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];

    const days = fitnessStatisticsService.getDaysSinceLastWorkout();
    // Quiet once the habit is clearly paused — "96 dias" is noise, not a nudge.
    if (days !== null && days >= 5 && isTrainingInUse(days)) {
      alerts.push({
        id: 'fitness-no-workout',
        moduleId: 'fitness',
        severity: days >= 7 ? 'warning' : 'info',
        title: `Você não treina há ${days} dias`,
        actionLabel: 'Registrar',
        actionRoute: '/treino/registrar',
      });
    }

    return alerts;
  },
};
