import { type AlertProvider, type HubAlert } from '../alerts/alert-types';
import { concursoService } from './concursoService';

export const editalAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts = concursoService.getActiveEditalAlerts();
    return alerts.slice(0, 3).map((alert, i) => ({
      id: `edital-${i}-${alert.detectedAt}`,
      moduleId: 'fitness',
      severity: 'critical' as const,
      title: `🚨 ${alert.title}`,
      description: `Palavra-chave detectada: "${alert.foundKeyword}"`,
      actionLabel: 'Ver concurso',
      actionRoute: '/concurso',
    }));
  },
};
