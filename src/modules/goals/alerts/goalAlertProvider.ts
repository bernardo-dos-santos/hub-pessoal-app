import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { goalService } from '../services/goalService';

export const goalAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];
    const active = goalService.listActive();

    if (active.length === 0) return alerts;

    // Metas com prazo próximo (até 7 dias)
    for (const goal of active) {
      const daysLeft = goalService.daysUntilTarget(goal);
      if (daysLeft !== null && daysLeft <= 7 && daysLeft >= 0) {
        alerts.push({
          id: `goal-deadline-${goal.id}`,
          moduleId: 'goals',
          severity: daysLeft <= 2 ? 'warning' : 'info',
          title: `Meta "${goal.title}" vence ${daysLeft === 0 ? 'hoje' : `em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`}`,
          description: `${goalService.getProgress(goal)}% concluída`,
          actionLabel: 'Ver meta',
          actionRoute: `/metas/${goal.id}`,
        });
      }
    }

    return alerts;
  },
};
