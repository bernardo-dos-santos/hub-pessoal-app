import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { weeklyPlanService } from '../services/weeklyPlanService';
import { sessionCompletionService } from '../../study/services/sessionCompletionService';

export const plannerAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=dom, 1=seg
    const hour = today.getHours();

    // ── Semana sem plano (alerta na segunda-feira) ────────────────────────────
    if (dayOfWeek === 1) {
      const plan = weeklyPlanService.getCurrentPlan();
      const targetWeekOf = weeklyPlanService.getTargetWeekOf();
      if (!plan || plan.weekOf !== targetWeekOf) {
        alerts.push({
          id: 'planner-no-weekly-plan',
          moduleId: 'planner',
          severity: 'warning',
          title: 'Plano semanal não gerado',
          description: 'Gere o plano para organizar as sessões desta semana',
          actionLabel: 'Gerar plano',
          actionRoute: '/plano-semanal',
        });
      }
    }

    // ── Sessões de hoje não concluídas após 21h ───────────────────────────────
    if (hour >= 21) {
      const todaySessions = sessionCompletionService.getTodaySessions();
      const weekOf = sessionCompletionService.getCurrentWeekOf();
      if (weekOf && todaySessions.length > 0) {
        const completions = sessionCompletionService.getWeekCompletions(weekOf);
        const unmarked = todaySessions.filter(({ index }) => !completions[index]);
        if (unmarked.length > 0) {
          alerts.push({
            id: 'planner-sessions-unmarked',
            moduleId: 'planner',
            severity: 'info',
            title: `${unmarked.length} sessão(ões) de hoje sem registro`,
            description: 'Marque como feito, parcial ou pulado antes de dormir',
            actionLabel: 'Ver plano',
            actionRoute: '/plano-semanal',
          });
        }
      }
    }

    return alerts;
  },
};
