import { Link } from 'react-router-dom';
import { TafStatusCard } from '../components/TafStatusCard';
import { fitnessStatisticsService } from '../services/fitnessStatisticsService';
import { tafService } from '../services/tafService';
import { Card, Eyebrow, HeroValue } from '../../../shared/ui';

function daysColor(daysSince: number | null): string {
  if (daysSince === null) return 'var(--hub-muted)';
  if (daysSince === 0) return 'var(--hub-positive)';
  if (daysSince <= 2) return 'var(--hub-text)';
  return 'var(--hub-warning)';
}

export function FitnessDashboardPage() {
  const testResults = tafService.getAllTestResults();
  const daysSince = fitnessStatisticsService.getDaysSinceLastWorkout();
  const workoutsThisWeek = fitnessStatisticsService.getWorkoutsThisWeek();

  return (
    <div className="space-y-6">
      {/* Resumo da semana — dois stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <Eyebrow>Esta semana</Eyebrow>
          <div className="mt-2 flex items-baseline gap-2">
            <HeroValue size={40}>{workoutsThisWeek}</HeroValue>
            <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>treinos</span>
          </div>
        </Card>
        <Card>
          <Eyebrow>Último treino</Eyebrow>
          <div className="mt-2">
            <HeroValue size={40} color={daysColor(daysSince)}>
              {daysSince === null ? '—' : daysSince === 0 ? 'Hoje' : `${daysSince}d`}
            </HeroValue>
          </div>
        </Card>
      </div>

      {/* Status TAF */}
      <section>
        <Eyebrow style={{ marginBottom: '10px' }}>Status TAF</Eyebrow>
        <div className="grid gap-4 sm:grid-cols-2">
          {testResults.map((result) => (
            <TafStatusCard key={result.requirement.id} result={result} />
          ))}
        </div>
      </section>

      {/* CTAs */}
      <div className="flex items-center gap-6 pt-1">
        <Link
          to="/treino/registrar"
          className="text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-primary)' }}
        >
          + Registrar treino
        </Link>
        <Link
          to="/treino/plano"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-muted)' }}
        >
          📋 Plano de treino
        </Link>
      </div>
    </div>
  );
}
