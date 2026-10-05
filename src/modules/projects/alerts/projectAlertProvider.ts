import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { frontService } from '../services/frontService';
import { projectMilestoneService, todayDate } from '../services/projectMilestoneService';
import { daysSince, projectService } from '../services/projectService';
import { projectTaskService } from '../services/projectTaskService';
import { DUE_MOVE_ALERT_THRESHOLD, isTaskClosed, isTaskOverdue } from '../types/projectTask';

/** Acima disto, frentes ativas demais ao mesmo tempo viram alerta de foco. */
const ACTIVE_FRONT_LIMIT = 3;

/**
 * Alertas do módulo Projetos.
 *
 * Era o único módulo ativo sem provider — e justamente aquele cuja descrição
 * é "cobrança de ritmo". A detecção de projeto parado já existia em
 * `isStalled` e nunca saía da própria tela do módulo, ou seja: quem não
 * abria o módulo não era cobrado, que é exatamente quem mais precisa.
 *
 * A ordem das regras é deliberada — da causa para o sintoma. "Frente sem
 * próxima ação" vale mais que "parado há 15 dias", porque a primeira diz o
 * que fazer e a segunda só constata.
 */
export const projectAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];
    const today = todayDate();
    const activeProjects = projectService.list().filter((p) => p.status === 'active');
    if (activeProjects.length === 0) return alerts;

    for (const project of activeProjects) {
      const route = `/projetos/${project.id}`;
      const fronts = frontService.listByProject(project.id).filter((f) => f.status === 'active');

      // 1. Causa: frente ativa, com tarefa aberta, e ninguém definiu o passo.
      for (const front of fronts) {
        if (front.nextActionTaskId) continue;
        if (frontService.openTaskCount(front.id) === 0) continue;
        alerts.push({
          id: `projects-no-next-action-${front.id}`,
          moduleId: 'projects',
          severity: 'warning',
          title: `"${front.name}" está sem próxima ação definida`,
          description: `${project.name} — a frente tem tarefas abertas, mas nenhuma apontada como o próximo passo.`,
          actionLabel: 'Definir próxima ação',
          actionRoute: route,
        });
      }

      // 2. Prazo estourado: decisão binária, não depende de interpretação.
      const overdueTasks = projectTaskService
        .listByProject(project.id)
        .filter((t) => isTaskOverdue(t, today));
      if (overdueTasks.length > 0) {
        alerts.push({
          id: `projects-overdue-tasks-${project.id}`,
          moduleId: 'projects',
          severity: 'warning',
          title: overdueTasks.length === 1
            ? `"${overdueTasks[0].title}" está com o prazo vencido`
            : `${overdueTasks.length} tarefas vencidas em ${project.name}`,
          description: project.name,
          actionLabel: 'Ver projeto',
          actionRoute: route,
        });
      }

      // 3. Marco vencido é mais grave que tarefa: significa que o plano do
      //    projeto não bateu com a realidade, não que uma tarefa atrasou.
      const overdueMilestones = projectMilestoneService.listOverdue(project.id);
      for (const milestone of overdueMilestones) {
        alerts.push({
          id: `projects-overdue-milestone-${milestone.id}`,
          moduleId: 'projects',
          severity: 'warning',
          title: `Marco "${milestone.title}" venceu em ${milestone.targetDate}`,
          description: `${project.name} — ainda não foi atingido.`,
          actionLabel: 'Ver projeto',
          actionRoute: route,
        });
      }

      // 4. Sintoma: já existia, só nunca tinha vitrine fora do módulo.
      if (projectService.isStalled(project)) {
        alerts.push({
          id: `projects-stalled-${project.id}`,
          moduleId: 'projects',
          severity: 'info',
          title: `${project.name} está parado há ${daysSince(project.lastActivityAt)} dias`,
          actionLabel: 'Abrir projeto',
          actionRoute: route,
        });
      }

      // 5. Tarefa adiada demais: sugere cancelar, não cobrar.
      const chronicallyPostponed = projectTaskService
        .listByProject(project.id)
        .filter((t) => !isTaskClosed(t) && (t.dueMoveCount ?? 0) >= DUE_MOVE_ALERT_THRESHOLD);
      for (const task of chronicallyPostponed) {
        alerts.push({
          id: `projects-postponed-${task.id}`,
          moduleId: 'projects',
          severity: 'info',
          title: `"${task.title}" já foi adiada ${task.dueMoveCount} vezes`,
          description: `${project.name} — talvez valha cancelar em vez de adiar de novo.`,
          actionLabel: 'Ver projeto',
          actionRoute: route,
        });
      }

      // 6. Trabalho em curso demais: cinco frentes a 5% cada não é progresso.
      if (fronts.length > ACTIVE_FRONT_LIMIT) {
        alerts.push({
          id: `projects-wip-${project.id}`,
          moduleId: 'projects',
          severity: 'info',
          title: `${project.name} tem ${fronts.length} frentes ativas ao mesmo tempo`,
          description: 'Pausar alguma costuma render mais que tocar todas devagar.',
          actionLabel: 'Ver frentes',
          actionRoute: route,
        });
      }
    }

    return alerts;
  },
};
