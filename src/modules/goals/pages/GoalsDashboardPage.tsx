import { useNavigate } from 'react-router-dom';
import { ModuleAttentionCard } from '../../../core/alerts/ModuleAttentionCard';
import { Button, Card, ModuleHeader } from '../../../shared/ui';
import { goalAlertProvider } from '../alerts/goalAlertProvider';
import { GoalRow } from '../components/GoalRow';
import { getGoalsTabs } from '../components/goalsTabs';
import { goalService } from '../services/goalService';

const sectionLabel = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' } as const;

/**
 * Resumo das Metas no formato dos módulos: o hero
 * responde "como estão as minhas metas?" — o progresso médio das ativas e a
 * próxima a vencer —, com "Nova meta"; ao lado o "Precisa de você" do
 * goalAlertProvider; embaixo as ativas, das que vencem antes para as sem prazo.
 */
export function GoalsDashboardPage() {
  const navigate = useNavigate();
  const all = goalService.listGoals();
  const active = all
    .filter((g) => g.status === 'active')
    .sort((a, b) => (goalService.daysUntilTarget(a) ?? Infinity) - (goalService.daysUntilTarget(b) ?? Infinity));
  const closed = all.length - active.length;

  const average = active.length > 0
    ? Math.round(active.reduce((sum, g) => sum + goalService.getProgress(g), 0) / active.length)
    : null;
  const next = active.find((g) => {
    const days = goalService.daysUntilTarget(g);
    return days !== null && days >= 0;
  });
  const nextDays = next ? goalService.daysUntilTarget(next) : null;

  let sentence: string;
  if (active.length === 0) {
    sentence = closed > 0
      ? 'Nenhuma meta ativa — as antigas estão em Encerradas.'
      : 'Nenhuma meta ainda. Uma meta aqui é um objetivo com key results: passos que dá para marcar como feitos.';
  } else {
    sentence = `${active.length} ${active.length === 1 ? 'meta ativa' : 'metas ativas'}. `;
    sentence += next && nextDays !== null
      ? `A próxima a vencer é "${next.title}", ${nextDays === 0 ? 'hoje' : `em ${nextDays} ${nextDays === 1 ? 'dia' : 'dias'}`}, com ${goalService.getProgress(next)}% feito.`
      : 'Nenhuma com prazo pela frente.';
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Metas" title="Resumo" tabs={getGoalsTabs()} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <Card hero>
            <p className="font-medium uppercase" style={sectionLabel}>Progresso das ativas</p>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="tabular-nums" style={{ fontSize: '58px', lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em', color: average === 100 ? 'var(--hub-positive)' : 'var(--hub-text)' }}>
                {average === null ? '—' : `${average}%`}
              </span>
              {average !== null && <span className="text-sm" style={{ color: 'var(--hub-muted)' }}>em média</span>}
            </div>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--hub-text-body)' }}>{sentence}</p>
            <div className="mt-5">
              <Button type="button" onClick={() => navigate('/metas/nova')}>Nova meta</Button>
            </div>
          </Card>

          <ModuleAttentionCard provider={goalAlertProvider} className="lg:hidden" />

          {active.length > 0 && (
            <Card>
              <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '2px' }}>Ativas</p>
              {active.map((g, i) => <GoalRow key={g.id} goal={g} last={i === active.length - 1} />)}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ModuleAttentionCard provider={goalAlertProvider} className="hidden lg:block" />
        </div>
      </div>
    </div>
  );
}
