import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { studySessionService } from '../services/studySessionService';
import { studyProgressService } from '../services/studyProgressService';
import { sessionCompletionService } from '../services/sessionCompletionService';
import { jarvisCheckInService } from '../services/jarvisCheckInService';
import { weeklyPlanService } from '../../planner/services/weeklyPlanService';
import { CBMSC_SUBJECTS } from '../data/cbmscSubjects';
import { ABIN_SUBJECTS } from '../data/abinSubjects';

const ALL_CONCURSO_SUBJECTS = [...CBMSC_SUBJECTS, ...ABIN_SUBJECTS];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const studyAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];
    const today = todayStr();

    // ── Streak em risco ───────────────────────────────────────────────────────
    const streak = studySessionService.getStreak();
    const recentLog = studySessionService.getRecentLog(2);
    const studiedToday = recentLog.some((e) => e.date === today);
    const studiedYesterday = recentLog.some((e) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return e.date === yesterday.toISOString().slice(0, 10);
    });

    if (streak >= 3 && studiedYesterday && !studiedToday) {
      alerts.push({
        id: 'study-streak-risk',
        moduleId: 'study',
        severity: 'warning',
        title: `Sequência de ${streak} dias em risco`,
        description: 'Você ainda não estudou hoje',
        actionLabel: 'Começar sessão',
        actionRoute: '/estudos/questoes/praticar',
      });
    }

    // ── Sessões de hoje não marcadas (a partir das 20h) ───────────────────────
    const hour = new Date().getHours();
    if (hour >= 20) {
      const todaySessions = sessionCompletionService.getTodaySessions();
      const weekOf = sessionCompletionService.getCurrentWeekOf();
      if (weekOf && todaySessions.length > 0) {
        const completions = sessionCompletionService.getWeekCompletions(weekOf);
        const unmarked = todaySessions.filter(({ index }) => !completions[index]);
        if (unmarked.length > 0) {
          alerts.push({
            id: 'study-sessions-unmarked',
            moduleId: 'study',
            severity: 'info',
            title: `${unmarked.length} sessão(ões) de hoje sem marcação`,
            description: 'Marque como feito, parcial ou pulado',
            actionLabel: 'Estudos',
            actionRoute: '/estudos',
          });
        }
      }
    }

    // ── Taxa de conclusão semanal baixa (qui/sex) ────────────────────────────
    const dayOfWeek = new Date().getDay(); // 0=dom, 4=qui, 5=sex
    if (dayOfWeek === 4 || dayOfWeek === 5) {
      const weekOf = sessionCompletionService.getCurrentWeekOf();
      if (weekOf) {
        const plan = weeklyPlanService.getCurrentPlan();
        if (plan) {
          const rate = sessionCompletionService.getCompletionRate(weekOf, plan.sessions.length);
          if (rate < 50) {
            alerts.push({
              id: 'study-week-low-rate',
              moduleId: 'study',
              severity: 'warning',
              title: `Conclusão semanal: ${rate}%`,
              description: 'Menos da metade das sessões concluídas esta semana',
              // O alerta é sobre sessões da semana não marcadas, e é a aba
              // Estudar que lista as sessões de hoje com ✓/~/✗. Apontava para a
              // tela de gerar conteúdo, que não tem relação com o aviso.
              actionLabel: 'Ver sessões',
              actionRoute: '/estudos',
            });
          }
        }
      }
    }

    // ── Mastery crítico ───────────────────────────────────────────────────────
    const masteries = studyProgressService.getMasteriesForTags(ALL_CONCURSO_SUBJECTS);
    const critical = masteries.filter((m) => m.score > 0 && m.score < 30);
    for (const m of critical.slice(0, 2)) {
      alerts.push({
        id: `study-mastery-critical-${m.tag}`,
        moduleId: 'study',
        severity: 'warning',
        title: `${m.tag}: domínio crítico (${m.score}%)`,
        description: 'Recomenda-se praticar antes do próximo simulado',
        actionLabel: 'Simular',
        actionRoute: `/estudos/simulados?tag=${encodeURIComponent(m.tag)}`,
      });
    }

    // ── Energia baixa hoje ────────────────────────────────────────────────────
    const checkIn = jarvisCheckInService.getTodayCheckIn();
    if (checkIn && checkIn.energy > 0 && checkIn.energy <= 2) {
      alerts.push({
        id: 'study-low-energy',
        moduleId: 'study',
        severity: 'info',
        title: 'Energia baixa hoje — sessão leve recomendada',
        description: 'Priorize revisão de flashcards em vez de questões novas',
        actionLabel: 'Flashcards',
        actionRoute: '/estudos/flashcards',
      });
    }

    // ── Risco de sobrecarga ───────────────────────────────────────────────────
    if (jarvisCheckInService.getBurnoutRisk() === 'high') {
      alerts.push({
        id: 'study-burnout-risk',
        moduleId: 'study',
        severity: 'warning',
        title: 'Sinais de sobrecarga detectados',
        description: 'Humor e energia baixos nos últimos 3 dias. Considere um dia de descanso.',
        actionRoute: '/estudos',
      });
    }

    return alerts;
  },
};
