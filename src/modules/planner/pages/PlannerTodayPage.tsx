import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModuleAttentionCard } from '../../../core/alerts/ModuleAttentionCard';
import { Button, Card, ListRow, ModuleHeader } from '../../../shared/ui';
import { sessionCompletionService, type CompletionStatus } from '../../study/services/sessionCompletionService';
import { plannerAlertProvider } from '../alerts/plannerAlertProvider';
import { getPlannerTabs } from '../components/plannerTabs';
import { TodaySessionRow } from '../components/TodaySessionRow';
import { weeklyPlanService } from '../services/weeklyPlanService';
import { routineService } from '../services/routineService';

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' } as const;

function toMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmtMins(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Resumo do Planejador no formato dos módulos: o
 * hero responde "o que vem agora?" — a próxima sessão do plano de hoje e quanto
 * falta do dia —, com as sessões marcáveis logo abaixo; ao lado o "Precisa de
 * você" do plannerAlertProvider e o balanço da semana.
 */
export function PlannerTodayPage() {
  const navigate = useNavigate();
  const plan = weeklyPlanService.getCurrentPlan();
  const weekOf = sessionCompletionService.getCurrentWeekOf();
  const today = sessionCompletionService.getTodaySessions()
    .sort((a, b) => toMins(a.session.startTime) - toMins(b.session.startTime));
  const [completions, setCompletions] = useState<Record<number, CompletionStatus>>(
    () => (weekOf ? sessionCompletionService.getWeekCompletions(weekOf) : {}),
  );

  function handleMark(index: number, status: CompletionStatus) {
    if (!weekOf) return;
    sessionCompletionService.markSession(weekOf, index, status);
    setCompletions(sessionCompletionService.getWeekCompletions(weekOf));
  }

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const open = today.filter(({ index }) => !completions[index]);
  const current = open.find(({ session }) => toMins(session.startTime) <= nowMins && nowMins < toMins(session.startTime) + session.durationMinutes);
  const next = current ?? open.find(({ session }) => toMins(session.startTime) > nowMins);
  const openMinutes = open.reduce((sum, { session }) => sum + session.durationMinutes, 0);

  let sentence: string;
  if (!plan) {
    sentence = routineService.hasRoutine()
      ? 'Nenhum plano para esta semana. Gere em Semana — ele distribui estudo e treino nos seus horários livres.'
      : 'Nenhum plano ainda. Comece pela rotina em Configurar; o plano semanal é montado em cima dela.';
  } else if (weeklyPlanService.isOutdated()) {
    sentence = 'O plano salvo é de uma semana anterior — gere o desta semana em Semana.';
  } else if (today.length === 0) {
    sentence = 'Nada planejado para hoje.';
  } else if (next) {
    sentence = current
      ? `Agora: ${next.session.topic}, até ${fmtMinsClock(toMins(next.session.startTime) + next.session.durationMinutes)}.`
      : `Próxima: ${next.session.topic} às ${next.session.startTime}.`;
    sentence += open.length > 1 ? ` Depois, mais ${open.length - 1} (${fmtMins(openMinutes - next.session.durationMinutes)}).` : ' É a última do dia.';
  } else if (open.length > 0) {
    sentence = `Os horários de hoje já passaram — marque o que aconteceu com ${open.length === 1 ? 'a sessão que falta' : `as ${open.length} sessões que faltam`}.`;
  } else {
    sentence = 'Tudo de hoje marcado.';
  }

  const weekSessions = plan && !weeklyPlanService.isOutdated() ? plan.sessions : [];
  const weekDone = weekOf ? Object.values(sessionCompletionService.getWeekCompletions(weekOf)).filter((s) => s === 'done').length : 0;
  const studyMin = weekSessions.filter((s) => s.type === 'study' || s.type === 'review').reduce((sum, s) => sum + s.durationMinutes, 0);
  const trainMin = weekSessions.filter((s) => s.type === 'train').reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Planejador" title="Hoje" tabs={getPlannerTabs()} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card hero>
            <p className="font-medium uppercase" style={sectionLabel}>{current ? 'Agora' : 'Hoje'}</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="tabular-nums" style={{ fontSize: '58px', lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em', color: today.length > 0 && open.length === 0 ? 'var(--hub-positive)' : 'var(--hub-text)' }}>
                {plan ? open.length : '—'}
              </span>
              {plan && (
                <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>
                  {open.length === 1 ? 'sessão pela frente' : 'sessões pela frente'}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{sentence}</p>
            {(!plan || weeklyPlanService.isOutdated()) && (
              <div className="mt-5">
                <Button type="button" onClick={() => navigate(routineService.hasRoutine() ? '/planner/semana' : '/planner/configurar')}>
                  {routineService.hasRoutine() ? 'Ir para Semana' : 'Configurar rotina'}
                </Button>
              </div>
            )}

            {today.length > 0 && weekOf && (
              <div className="mt-5" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '12px' }}>
                {today.map(({ session, index }, i) => (
                  <TodaySessionRow
                    key={`${weekOf}:${index}`}
                    session={session}
                    status={completions[index] ?? null}
                    last={i === today.length - 1}
                    onMark={(s) => handleMark(index, s)}
                  />
                ))}
              </div>
            )}
          </Card>

          <ModuleAttentionCard provider={plannerAlertProvider} className="lg:hidden" />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModuleAttentionCard provider={plannerAlertProvider} className="hidden lg:block" />
          {weekSessions.length > 0 && plan && (
            <Card>
              <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>
                Semana · {weeklyPlanService.formatWeekRange(plan.weekOf)}
              </p>
              <ListRow to="/planner/semana" label="Sessões feitas" value={<span className="tabular-nums">{weekDone}/{weekSessions.length}</span>} />
              <ListRow to="/planner/semana" label="Estudo planejado" value={<span className="tabular-nums">{studyMin > 0 ? fmtMins(studyMin) : '—'}</span>} />
              <ListRow to="/planner/semana" label="Treino planejado" value={<span className="tabular-nums">{trainMin > 0 ? fmtMins(trainMin) : '—'}</span>} last />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtMinsClock(total: number) {
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
