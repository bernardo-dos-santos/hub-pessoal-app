import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { assessmentService } from '../services/assessmentService';
import { taskService } from '../services/taskService';
import { todayKey } from '../utils/collegePeriod';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function in7DaysKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export const collegeAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];
    const today = todayKey();
    const limit = in7DaysKey();

    const soonAssessments = assessmentService
      .listUpcomingAssessments(5)
      .filter((a) => a.date <= limit)
      .slice(0, 2);

    for (const assessment of soonAssessments) {
      const days = daysUntil(assessment.date);
      const daysLabel =
        days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
      alerts.push({
        id: `college-assessment-${assessment.id}`,
        moduleId: 'college',
        severity: days <= 1 ? 'critical' : 'warning',
        title: `Prova ${daysLabel}: ${assessment.title}`,
        actionLabel: 'Ver avaliações',
        actionRoute: '/faculdade/avaliacoes',
      });
    }

    const urgentTasks = taskService
      .listTasks()
      .filter((t) => {
        if (t.status !== 'pending' && t.status !== 'in_progress') return false;
        const due = t.dueDate.split('T')[0];
        return due >= today && daysUntil(due) <= 1;
      });

    if (urgentTasks.length > 0) {
      const label =
        urgentTasks.length === 1
          ? urgentTasks[0].title
          : `${urgentTasks.length} tarefas com prazo hoje ou amanhã`;
      alerts.push({
        id: 'college-urgent-tasks',
        moduleId: 'college',
        severity: 'warning',
        title: label,
        actionLabel: 'Ver tarefas',
        actionRoute: '/faculdade/tarefas',
      });
    }

    return alerts;
  },
};
