import { useState } from 'react';
import { aiFitnessPlannedService, type FitnessTrainingPlan, type TrainingSession } from '../services/aiFitnessPlannedService';
import { Card, Button, Eyebrow } from '../../../shared/ui';

const TYPE_COLOR: Record<TrainingSession['type'], string> = {
  running:  'var(--hub-positive)',
  strength: 'var(--hub-accent)',
  sit_up:   'var(--hub-warning)',
  push_up:  'var(--hub-progress)',
  pull_up:  'var(--hub-mauve)',
  rest:     'var(--hub-subtle)',
  mixed:    'var(--hub-negative)',
};

const TYPE_LABEL: Record<TrainingSession['type'], string> = {
  running: 'Corrida', strength: 'Força', sit_up: 'Abdominal',
  push_up: 'Flexão', pull_up: 'Barra', rest: 'Descanso', mixed: 'Misto',
};

function SessionCard({ session, last }: { session: TrainingSession; last: boolean }) {
  const color = TYPE_COLOR[session.type] ?? TYPE_COLOR.mixed;
  return (
    <div className="flex gap-3" style={{ padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--hub-label)' }}>
              {session.day}
            </p>
            <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{session.title}</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--hub-muted)' }}>
              {session.description}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px]" style={{ color: 'var(--hub-label)' }}>{TYPE_LABEL[session.type]}</p>
            <p className="text-xs font-medium tabular-nums" style={{ color }}>{session.durationMinutes}min</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FitnessPlannedPage() {
  const [plan, setPlan] = useState<FitnessTrainingPlan | null>(() => aiFitnessPlannedService.getCachedPlan());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number>(1);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await aiFitnessPlannedService.generatePlan();
      setPlan(result);
      setExpandedWeek(1);
    } catch {
      setError('Falha ao gerar plano. Verifique a chave de IA nas configurações.');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    aiFitnessPlannedService.clearPlan();
    setPlan(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <Eyebrow>Plano de treino</Eyebrow>
        <p className="mt-1 text-xs" style={{ color: 'var(--hub-muted)' }}>
          Adaptativo — gerado por IA baseado no seu TAF e histórico
        </p>
        <div className="mt-4">
          <Button variant={plan ? 'text' : 'primary'} onClick={handleGenerate} disabled={loading}>
            {loading ? 'Gerando plano…' : plan ? '↺ Regerar plano de treino' : '+ Gerar plano de treino'}
          </Button>
        </div>
        {error && <p className="mt-3 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
      </Card>

      {/* Plano existente */}
      {plan && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <Eyebrow>Fase {plan.phase} · {plan.totalWeeks} semanas</Eyebrow>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{plan.objective}</p>
              <p className="mt-1 text-[10px]" style={{ color: 'var(--hub-subtle)' }}>
                Gerado em {new Date(plan.generatedAt).toLocaleString('pt-BR')}
              </p>
            </div>
            <button onClick={handleClear} className="text-[10px] transition-opacity hover:opacity-70" style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Limpar
            </button>
          </div>

          {plan.weeks.map((week) => (
            <div key={week.weekNumber} style={{ borderTop: '1px solid var(--hub-border)' }}>
              <button
                onClick={() => setExpandedWeek(expandedWeek === week.weekNumber ? 0 : week.weekNumber)}
                className="flex w-full items-center justify-between py-3 text-left transition-opacity hover:opacity-80"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--hub-text)' }}>Semana {week.weekNumber}</p>
                  <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>{week.focus}</p>
                </div>
                <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                  {expandedWeek === week.weekNumber ? '▲' : '▼'}
                </span>
              </button>
              {expandedWeek === week.weekNumber && (
                <div className="pb-2">
                  {week.sessions.map((session, i) => (
                    <SessionCard key={i} session={session} last={i === week.sessions.length - 1} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
