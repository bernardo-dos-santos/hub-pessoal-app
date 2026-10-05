import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { goalService } from '../services/goalService';

export const goalAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];
    const active = goalService.listActive();

    if (active.length === 0) return alerts;

    // Metas com prazo próximo (< 7 dias)
    const today = new Date();
    for (const goal of active) {
      if (!goal.targetDate) continue;
      const daysLeft = Math.round(
        (new Date(goal.targetDate).getTime() - today.getTime()) / 86400000,
      );
      if (daysLeft <= 7 && daysLeft >= 0) {
        alerts.push({
          id: `goal-deadline-${goal.id}`,
          moduleId: 'goals',
          severity: daysLeft <= 2 ? 'warning' : 'info',
          title: `Meta "${goal.title}" vence em ${daysLeft === 0 ? 'hoje' : `${daysLeft} dia(s)`}`,
          description: `${goalService.getProgress(goal)}% concluída`,
          actionLabel: 'Ver meta',
          actionRoute: `/metas/${goal.id}`,
        });
      }
    }

    return alerts;
  },
};
