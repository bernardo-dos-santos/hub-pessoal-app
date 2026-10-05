import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { weeklyPlanService } from '../services/weeklyPlanService';
import { generateSessionBreakdown } from '../services/aiSessionBreakdownService';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import { type StudyBreakdownItem, type WeeklySession, WEEK_DAY_LABEL } from '../types/routine';
import { Card, BackButton, Eyebrow } from '../../../shared/ui';

function formatMins(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatEnd(startTime: string, durationMinutes: number) {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const TYPE_LABEL: Record<string, string> = {
  study: 'Estudo', review: 'Revisão', train: 'Treino',
  rest: 'Descanso', admin: 'Administrativo', other: 'Outro',
};

const TYPE_COLOR: Record<string, string> = {
  study:  'var(--hub-accent)',
  review: 'var(--hub-mauve)',
  train:  'var(--hub-positive)',
  rest:   'var(--hub-muted)',
  admin:  'var(--hub-warning)',
  other:  'var(--hub-muted)',
};

const PRIORITY_LABEL: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_COLOR: Record<string, string> = {
  high:   'var(--hub-negative)',
  medium: 'var(--hub-warning)',
  low:    'var(--hub-muted)',
};

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const aiReady = useAiAvailable();
  const [session, setSession] = useState<WeeklySession | null>(null);
  const [breakdown, setBreakdown] = useState<StudyBreakdownItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    const found = weeklyPlanService.getSessionById(sessionId);
    setSession(found);
    if (found && (found.type === 'study' || found.type === 'review') && aiReady) {
      loadBreakdown(found);
    }
  }, [sessionId, aiReady]);

  async function loadBreakdown(s: WeeklySession) {
    setLoading(true);
    setError('');
    try {
      const items = await generateSessionBreakdown(s);
      setBreakdown(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar detalhes.');
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <BackButton />
        <Card><p className="text-sm" style={{ color: 'var(--hub-muted)' }}>Sessão não encontrada.</p></Card>
      </div>
    );
  }

  const endTime = formatEnd(session.startTime, session.durationMinutes);
  const totalBreakdown = breakdown.reduce((s, i) => s + i.durationMinutes, 0);
  const isStudyType = session.type === 'study' || session.type === 'review';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BackButton />

      {/* Header da sessão */}
      <Card hero>
        <div className="mb-2.5 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: TYPE_COLOR[session.type] ?? TYPE_COLOR.other }}>
            {TYPE_LABEL[session.type] ?? session.type}
          </span>
          <span className="text-xs font-medium" style={{ color: PRIORITY_COLOR[session.priority] ?? PRIORITY_COLOR.low }}>
            Prioridade {(PRIORITY_LABEL[session.priority] ?? session.priority).toLowerCase()}
          </span>
        </div>
        <h1 className="mb-5 text-xl leading-snug" style={{ color: 'var(--hub-text)', fontWeight: 500 }}>{session.topic}</h1>

        <div className="mb-4 flex flex-wrap items-start gap-9">
          <div>
            <Eyebrow style={{ marginBottom: '4px' }}>Dia</Eyebrow>
            <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{WEEK_DAY_LABEL[session.day]}</p>
          </div>
          <div>
            <Eyebrow style={{ marginBottom: '4px' }}>Horário</Eyebrow>
            <p className="text-sm tabular-nums" style={{ color: 'var(--hub-text)' }}>{session.startTime} – {endTime}</p>
          </div>
          <div>
            <Eyebrow style={{ marginBottom: '4px' }}>Duração</Eyebrow>
            <p className="text-sm tabular-nums" style={{ color: 'var(--hub-text)' }}>{formatMins(session.durationMinutes)}</p>
          </div>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--hub-muted)' }}>{session.reason}</p>
      </Card>

      {/* Breakdown (só para estudo/revisão) */}
      {isStudyType && (
        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <Eyebrow>Ordem de estudo</Eyebrow>
            {breakdown.length > 0 && (
              <span className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>{formatMins(totalBreakdown)} planejados</span>
            )}
          </div>

          {loading && <p className="py-8 text-center text-xs" style={{ color: 'var(--hub-muted)' }}>Gerando ordem de estudo…</p>}

          {error && (
            <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>
              ✗ {error}
              <button type="button" onClick={() => loadBreakdown(session)} className="ml-3 underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Tentar novamente
              </button>
            </p>
          )}

          {!loading && breakdown.length > 0 && (
            <div>
              {breakdown.map((item, i) => (
                <div key={i} style={{ padding: '13px 0', borderBottom: i === breakdown.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{i + 1}.</span>
                      <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{item.subtopic}</p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--hub-muted)' }}>{formatMins(item.durationMinutes)}</span>
                  </div>
                  <p className="ml-7 mt-1 text-xs leading-relaxed" style={{ color: 'var(--hub-muted)' }}>{item.instruction}</p>
                </div>
              ))}
            </div>
          )}

          {!aiReady && (
            <p className="text-xs" style={{ color: 'var(--hub-warning)' }}>
              IA não configurada —{' '}
              <Link to="/configuracoes/ia" className="underline underline-offset-2 transition-opacity hover:opacity-70">
                configure para ver o detalhamento
              </Link>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
