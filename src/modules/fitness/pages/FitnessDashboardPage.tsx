import { useNavigate } from 'react-router-dom';
import { ModuleAttentionCard } from '../../../core/alerts/ModuleAttentionCard';
import { localDayKey } from '../../../shared/dates/localDay';
import { Button, Card, ListRow, ModuleHeader } from '../../../shared/ui';
import { fitnessAlertProvider } from '../alerts/fitnessAlertProvider';
import { getFitnessTabs } from '../components/fitnessTabs';
import { WORKOUT_TYPE_EMOJI, WORKOUT_TYPE_LABEL, shortWorkoutDate, workoutValue } from '../components/workoutFormat';
import { aiFitnessPlannedService } from '../services/aiFitnessPlannedService';
import { fitnessStatisticsService } from '../services/fitnessStatisticsService';
import { workoutService } from '../services/workoutService';
import { type Workout, type WorkoutType } from '../types/workout';

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' } as const;

function daysColor(daysSince: number | null): string {
  if (daysSince === null) return 'var(--hub-muted)';
  if (daysSince <= 1) return 'var(--hub-positive)';
  if (daysSince <= 3) return 'var(--hub-text)';
  return 'var(--hub-warning)';
}

function dayHeading(date: string, today: string, yesterday: string): string {
  if (date === today) return 'Hoje';
  if (date === yesterday) return 'Ontem';
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

/**
 * Resumo do Treino no formato dos módulos: o hero
 * responde "há quanto tempo eu não treino?" num número e numa frase, com o botão
 * de registrar; ao lado o "Precisa de você" do fitnessAlertProvider. Embaixo, os
 * últimos 14 dias agrupados por dia e a última marca de cada tipo de treino.
 */
export function FitnessDashboardPage() {
  const navigate = useNavigate();
  const daysSince = fitnessStatisticsService.getDaysSinceLastWorkout();
  const workoutsThisWeek = fitnessStatisticsService.getWorkoutsThisWeek();
  const workouts = workoutService.listWorkouts();
  const last = workouts[0] ?? null;
  const plan = aiFitnessPlannedService.getCachedPlan();

  const now = new Date();
  const today = localDayKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = localDayKey(yesterdayDate);
  const cutoffDate = new Date(now);
  cutoffDate.setDate(now.getDate() - 13);
  const cutoff = localDayKey(cutoffDate);

  const recentByDay = new Map<string, Workout[]>();
  for (const w of workouts) {
    if (w.date < cutoff) continue;
    recentByDay.set(w.date, [...(recentByDay.get(w.date) ?? []), w]);
  }

  const lastByType = (Object.keys(WORKOUT_TYPE_LABEL) as WorkoutType[])
    .map((type) => workoutService.getLastByType(type))
    .filter((w): w is Workout => w !== null);

  const sentence = last === null
    ? 'Nenhum treino registrado ainda — o primeiro começa a contagem.'
    : `Último: ${WORKOUT_TYPE_LABEL[last.type].toLowerCase()}${workoutValue(last) !== '—' ? `, ${workoutValue(last)}` : ''}. `
      + (workoutsThisWeek > 0
        ? `${workoutsThisWeek} ${workoutsThisWeek === 1 ? 'treino' : 'treinos'} nesta semana.`
        : 'Nenhum treino nesta semana ainda.');

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Treino" title="Resumo" tabs={getFitnessTabs()} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card hero>
            <p className="font-medium uppercase" style={sectionLabel}>Último treino</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="tabular-nums" style={{ fontSize: '58px', lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em', color: daysColor(daysSince) }}>
                {daysSince === null ? '—' : daysSince === 0 ? 'Hoje' : daysSince}
              </span>
              {daysSince !== null && daysSince > 0 && (
                <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>
                  {daysSince === 1 ? 'dia atrás' : 'dias atrás'}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{sentence}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button type="button" onClick={() => navigate('/treino/registrar')}>Registrar treino</Button>
              <button
                type="button"
                onClick={() => navigate('/treino/plano')}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {plan ? 'Ver plano de treino' : 'Gerar plano de treino'}
              </button>
            </div>
          </Card>

          <ModuleAttentionCard provider={fitnessAlertProvider} className="lg:hidden" />

          <Card>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>Últimos 14 dias</p>
            {recentByDay.size === 0 ? (
              <p className="py-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhum treino nas últimas duas semanas.</p>
            ) : (
              [...recentByDay.entries()].map(([date, dayWorkouts], dayIndex, days) => (
                <div key={date} style={{ paddingTop: '10px' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--hub-subtle)' }}>{dayHeading(date, today, yesterday)}</p>
                  {dayWorkouts.map((w, i) => (
                    <ListRow
                      key={w.id}
                      to="/treino/historico"
                      last={dayIndex === days.length - 1 && i === dayWorkouts.length - 1}
                      label={(
                        <span className="text-sm" style={{ color: 'var(--hub-text)' }}>
                          {WORKOUT_TYPE_EMOJI[w.type]} {WORKOUT_TYPE_LABEL[w.type]}
                        </span>
                      )}
                      value={<span className="tabular-nums text-sm" style={{ color: 'var(--hub-text-body)' }}>{workoutValue(w)}</span>}
                    />
                  ))}
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModuleAttentionCard provider={fitnessAlertProvider} className="hidden lg:block" />
          <Card>
            <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>Última marca por tipo</p>
            {lastByType.length === 0 ? (
              <p className="py-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Aparece aqui depois do primeiro registro.</p>
            ) : (
              lastByType.map((w, i) => (
                <ListRow
                  key={w.type}
                  last={i === lastByType.length - 1}
                  label={(
                    <>
                      <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{WORKOUT_TYPE_LABEL[w.type]}</p>
                      <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{shortWorkoutDate(w.date)}</p>
                    </>
                  )}
                  value={<span className="tabular-nums text-sm" style={{ color: 'var(--hub-text-body)' }}>{workoutValue(w)}</span>}
                />
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
