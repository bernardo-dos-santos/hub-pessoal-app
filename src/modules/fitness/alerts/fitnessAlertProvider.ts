import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { fitnessStatisticsService } from '../services/fitnessStatisticsService';
import { tafService } from '../services/tafService';

export const fitnessAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];

    const days = fitnessStatisticsService.getDaysSinceLastWorkout();
    if (days !== null && days >= 5) {
      alerts.push({
        id: 'fitness-no-workout',
        moduleId: 'fitness',
        severity: days >= 7 ? 'warning' : 'info',
        title: `Você não treina há ${days} dias`,
        actionLabel: 'Registrar',
        actionRoute: '/treino/registrar',
      });
    }

    const critical = tafService.getMostCriticalTest();
    if (critical?.status === 'below') {
      const unit = critical.requirement.workoutType === 'running' ? 'm' : ' reps';
      alerts.push({
        id: `fitness-taf-${critical.requirement.id}`,
        moduleId: 'fitness',
        severity: 'warning',
        title: `TAF: ${critical.requirement.testName} abaixo do mínimo`,
        description: critical.gap !== null ? `Faltam ${critical.gap}${unit}` : undefined,
        actionLabel: 'Ver TAF',
        actionRoute: '/treino/taf',
      });
    }

    return alerts;
  },
};
