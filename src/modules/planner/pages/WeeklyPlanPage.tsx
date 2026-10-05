import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import { rebuildDailyContext } from '../../../core/context/contextBuilder';
import { generateWeeklyPlan } from '../services/aiWeeklyPlanService';
import { weeklyPlanService } from '../services/weeklyPlanService';
import { routineService } from '../services/routineService';
import { sessionCompletionService } from '../../study/services/sessionCompletionService';
import { ModuleHeader, type ModuleTab } from '../../../shared/ui';
import {
  WEEK_DAYS,
  WEEK_DAY_LABEL,
  WEEK_DAY_SHORT,
  type SessionType,
  type WeekDay,
  type WeeklyPlan,
  type WeeklySession,
} from '../types/routine';

const PLANNER_TABS: ModuleTab[] = [
  { label: 'Plano semanal', to: '/planner', end: true },
  { label: 'Rotina',        to: '/planner/rotina' },
];

// ── Grade ─────────────────────────────────────────────────────────────────────

const HOUR_START = 6;
const HOUR_END   = 23;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_PX     = 64;
const GRID_H     = HOURS.length * ROW_PX;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function topPx(t: string)  { return Math.max(0, (toMins(t) - HOUR_START * 60) / 60 * ROW_PX); }
function heightPx(m: number) { return Math.max(ROW_PX / 4, (m / 60) * ROW_PX); }
function endTime(start: string, dur: number) {
  const t = toMins(start) + dur;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function fmtMins(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ── Cores por tipo de sessão (blocos = data-viz semântica) ────────────────────

const TYPE_ACCENT: Record<SessionType, string> = {
  study:  'var(--hub-accent)',
  review: 'var(--hub-mauve)',
  train:  'var(--hub-positive)',
  rest:   'var(--hub-subtle)',
  admin:  'var(--hub-warning)',
  other:  'var(--hub-muted)',
};
const TYPE_FILL: Record<SessionType, string> = {
  study:  'rgba(193,99,61,0.10)',
  review: 'rgba(158,118,134,0.12)',
  train:  'rgba(107,122,94,0.12)',
  rest:   'rgba(58,44,34,0.04)',
  admin:  'rgba(180,138,62,0.12)',
  other:  'rgba(58,44,34,0.05)',
};
const TYPE_LABEL: Record<SessionType, string> = {
  study: 'Estudo', review: 'Revisão', train: 'Treino',
  rest: 'Descanso', admin: 'Admin', other: 'Outro',
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'var(--hub-negative)', medium: 'var(--hub-warning)', low: 'transparent',
};

const CLICKABLE_TYPES: SessionType[] = ['study', 'review'];

// ── Agenda de um dia (mobile) ────────────────────────────────────────────────
// A grade de 7 colunas lado a lado (feita pra desktop) fica ilegível em tela
// de celular — cada dia sobra ~50px de largura, texto cortado, toque impreciso.
// Abaixo de `sm`, troca por um seletor de dia + lista de cards em largura
// total: mesma informação, mas de fato tocável e legível no celular.

function DaySessionCard({ session }: { session: WeeklySession }) {
  const navigate = useNavigate();
  const end = endTime(session.startTime, session.durationMinutes);
  const type = session.type ?? 'other';
  const isClickable = CLICKABLE_TYPES.includes(type);

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => isClickable && navigate(`/planner/plano-semanal/sessao/${session.id}`)}
      className="flex w-full items-start gap-3 py-3 text-left transition-opacity active:opacity-70 disabled:cursor-default"
      style={{ borderBottom: '1px solid var(--hub-border)' }}
    >
      <div className="w-14 shrink-0 pt-0.5">
        <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--hub-text)' }}>{session.startTime}</p>
        <p className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{end}</p>
      </div>
      <div className="min-w-0 flex-1" style={{ borderLeft: `2px solid ${TYPE_ACCENT[type] ?? TYPE_ACCENT.other}`, paddingLeft: '10px' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: TYPE_ACCENT[type] }}>
            {TYPE_LABEL[type]}
          </span>
          {session.priority !== 'low' && (
            <span className="h-1 w-1 rounded-full" style={{ background: PRIORITY_DOT[session.priority] }} />
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{session.topic}</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-muted)' }}>{fmtMins(session.durationMinutes)}{isClickable ? ' · toque para detalhar' : ''}</p>
      </div>
    </button>
  );
}

function DayAgenda({
  sessionsByDay,
  selectedDay,
  onSelectDay,
  todayIndex,
}: {
  sessionsByDay: Record<string, WeeklySession[]>;
  selectedDay: WeekDay;
  onSelectDay: (day: WeekDay) => void;
  todayIndex: number;
}) {
  const sessions = [...sessionsByDay[selectedDay]].sort((a, b) => toMins(a.startTime) - toMins(b.startTime));

  return (
    <div style={{ borderRadius: 'var(--hub-radius-card)', background: 'var(--hub-card)', boxShadow: 'var(--hub-shadow-card)' }}>
      <div className="flex gap-1 overflow-x-auto px-2 pt-2" style={{ borderBottom: '1px solid var(--hub-border)' }}>
        {WEEK_DAYS.map((day, i) => {
          const dayMin = sessionsByDay[day].reduce((s, ss) => s + ss.durationMinutes, 0);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`hub-tab shrink-0${selectedDay === day ? ' active' : ''}`}
            >
              <span className="block">{WEEK_DAY_SHORT[day]}</span>
              {i === todayIndex && <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full" style={{ background: 'var(--hub-primary)' }} />}
              {i !== todayIndex && dayMin > 0 && <span className="mt-0.5 block text-[9px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{fmtMins(dayMin)}</span>}
            </button>
          );
        })}
      </div>
      <div className="px-3">
        {sessions.length === 0 ? (
          <p className="py-10 text-center text-sm" style={{ color: 'var(--hub-subtle)' }}>Nada agendado para {WEEK_DAY_LABEL[selectedDay].toLowerCase()}.</p>
        ) : (
          sessions.map((s) => <DaySessionCard key={s.id} session={s} />)
        )}
      </div>
    </div>
  );
}

// ── SessionBlock ──────────────────────────────────────────────────────────────

function SessionBlock({ session }: { session: WeeklySession }) {
  const navigate   = useNavigate();
  const top        = topPx(session.startTime);
  const height     = heightPx(session.durationMinutes);
  const end        = endTime(session.startTime, session.durationMinutes);
  const small      = height < 50;
  const type       = session.type ?? 'other';
  const isClickable = CLICKABLE_TYPES.includes(type);

  const content = (
    <>
      {small ? (
        <div className="flex h-full items-center gap-1 overflow-hidden px-2 py-1">
          <span className="truncate text-left text-[10px] font-medium leading-none" style={{ color: 'var(--hub-text)' }}>
            {session.topic}
          </span>
          <span className="ml-auto shrink-0 text-[9px] tabular-nums" style={{ color: 'var(--hub-muted)' }}>
            {session.startTime}
          </span>
        </div>
      ) : (
        <div className="h-full space-y-0.5 overflow-hidden px-2 py-1.5 text-left">
          <div className="mb-0.5 flex items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: TYPE_ACCENT[type] }}>
              {TYPE_LABEL[type]}
            </span>
            {session.priority !== 'low' && (
              <span className="h-1 w-1 rounded-full" style={{ background: PRIORITY_DOT[session.priority] }} />
            )}
          </div>
          <p className="line-clamp-2 text-[11px] font-medium leading-snug" style={{ color: 'var(--hub-text)' }}>
            {session.topic}
          </p>
          <p className="text-[10px] tabular-nums" style={{ color: 'var(--hub-muted)' }}>
            {session.startTime} – {end}
          </p>
          {isClickable && height >= 80 && (
            <p className="mt-0.5 text-[9px]" style={{ color: 'var(--hub-subtle)' }}>toque para detalhar →</p>
          )}
        </div>
      )}
    </>
  );

  const blockStyle: React.CSSProperties = {
    top,
    height,
    borderRadius: '8px',
    background: TYPE_FILL[type] ?? TYPE_FILL.other,
    border: 'none',
    borderLeft: `2px solid ${TYPE_ACCENT[type] ?? TYPE_ACCENT.other}`,
    cursor: isClickable ? 'pointer' : 'default',
  };

  if (isClickable) {
    return (
      <button
        type="button"
        className="absolute inset-x-0.5 overflow-hidden transition-opacity hover:opacity-80"
        style={blockStyle}
        onClick={() => navigate(`/planner/plano-semanal/sessao/${session.id}`)}
        title={`${session.topic} — clique para detalhar`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="absolute inset-x-0.5 overflow-hidden" style={blockStyle}>
      {content}
    </div>
  );
}

// ── Calha de horas ────────────────────────────────────────────────────────────

function TimeGutter() {
  return (
    <div className="relative w-12 shrink-0 select-none" style={{ height: GRID_H }}>
      {HOURS.map((h) => (
        <div key={h} className="absolute right-2 -translate-y-2" style={{ top: (h - HOUR_START) * ROW_PX }}>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{String(h).padStart(2, '0')}h</span>
        </div>
      ))}
    </div>
  );
}

function GridLines() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {HOURS.map((h) => (
        <div key={h} className="absolute inset-x-0" style={{ top: (h - HOUR_START) * ROW_PX, borderTop: '1px solid var(--hub-border)' }} />
      ))}
    </div>
  );
}

function NowLine() {
  const now  = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  if (nowH < HOUR_START || nowH > HOUR_END) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: (nowH - HOUR_START) * ROW_PX }}>
      <div className="h-px flex-1" style={{ background: 'var(--hub-primary)' }} />
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--hub-primary)' }} />
    </div>
  );
}

// ── WeeklyPlanPage ────────────────────────────────────────────────────────────

export function WeeklyPlanPage() {
  const aiReady   = useAiAvailable();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [plan, setPlan]     = useState<WeeklyPlan | null>(() => weeklyPlanService.getCurrentPlan());
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [autoRegen, setAutoRegen] = useState(false);
  const [autoOn, setAutoOn] = useState(() => weeklyPlanService.isAutoGenerateEnabled());
  const hasRoutine  = routineService.hasRoutine();
  const isOutdated  = weeklyPlanService.isOutdated();
  const todayIndex  = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<WeekDay>(WEEK_DAYS[todayIndex]);

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const top = (now.getHours() + now.getMinutes() / 60 - HOUR_START) * ROW_PX;
      scrollRef.current.scrollTop = Math.max(0, top - 120);
    }
  }, [plan]);

  useEffect(() => {
    if (weeklyPlanService.isAutoGenerateEnabled() && weeklyPlanService.isSundayAndNeedsRegen() && aiReady && !loading) {
      setAutoRegen(true);
      handleGenerate('auto_sunday');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAuto() {
    const next = !autoOn;
    weeklyPlanService.setAutoGenerate(next);
    setAutoOn(next);
  }

  function deletePlan() {
    if (!plan) return;
    if (!confirm(`Excluir o plano da semana de ${plan.weekOf}?\n\nAs marcações de sessões concluídas dessa semana também serão apagadas.`)) return;
    // Ordem importa: precisa do weekOf do plano antes de descartá-lo. As
    // completions são indexadas por posição, então sem limpar aqui elas
    // voltariam a valer se um plano novo fosse gerado pra mesma semana.
    sessionCompletionService.clearWeek(plan.weekOf);
    weeklyPlanService.clearPlan();
    // Sem isto, o dailyContext (o que o Jarvis lê) só recalcula no próximo
    // boot ou troca de dia — até lá ele continuaria vendo as sessões do
    // plano apagado como se ainda existissem.
    rebuildDailyContext();
    setPlan(null);
  }

  async function handleGenerate(source: 'manual' | 'auto_sunday' = 'manual') {
    setLoading(true);
    setError('');
    try {
      const sessions = await generateWeeklyPlan();
      if (sessions.length === 0) throw new Error('A IA não retornou sessões. Tente novamente.');
      const saved = weeklyPlanService.savePlan({ weekOf: weeklyPlanService.getTargetWeekOf(), sessions: sessions as WeeklySession[], source });
      setPlan(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar agenda.');
    } finally {
      setLoading(false);
    }
  }

  const header = <ModuleHeader eyebrow="Módulo · Planejamento" title="Planner" tabs={PLANNER_TABS} />;

  if (!aiReady) {
    return (
      <div>
        {header}
        <div className="py-16 text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--hub-warning)' }}>IA não configurada</p>
          <Link
            to="/configuracoes/ia"
            className="mt-3 inline-block text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-primary)' }}
          >
            Configurar IA →
          </Link>
        </div>
      </div>
    );
  }

  const sessionsByDay = WEEK_DAYS.reduce<Record<string, WeeklySession[]>>((acc, day) => {
    acc[day] = (plan?.sessions ?? []).filter((s) => s.day === day);
    return acc;
  }, {});

  const totalSessions = plan?.sessions.length ?? 0;
  const totalMin      = plan?.sessions.reduce((s, ss) => s + ss.durationMinutes, 0) ?? 0;
  const studyMin      = plan?.sessions.filter((s) => s.type === 'study' || s.type === 'review').reduce((s, ss) => s + ss.durationMinutes, 0) ?? 0;
  const trainMin      = plan?.sessions.filter((s) => s.type === 'train').reduce((s, ss) => s + ss.durationMinutes, 0) ?? 0;

  return (
    <div>
      {header}
      <div className="space-y-5">
        {/* Sub-header agenda */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium" style={{ color: 'var(--hub-text)' }}>Agenda semanal</h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--hub-muted)' }}>
              {plan ? weeklyPlanService.formatWeekRange(plan.weekOf) : 'Nenhuma agenda gerada ainda'}
              {plan?.source === 'auto_sunday' && (
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--hub-primary)' }}>auto</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-baseline gap-5">
            <button
              type="button"
              onClick={toggleAuto}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: autoOn ? 'var(--hub-subtle)' : 'var(--hub-warning)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {autoOn ? 'auto: ligado' : 'auto: desligado'}
            </button>
            {plan && (
              <button
                type="button"
                onClick={deletePlan}
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Excluir
              </button>
            )}
            <button
              type="button"
              onClick={() => handleGenerate('manual')}
              disabled={loading}
              className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--hub-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {loading ? 'Gerando…' : plan ? '↺ Regenerar' : 'Gerar agenda'}
            </button>
          </div>
        </div>

        {/* Avisos */}
        {autoRegen && loading && (
          <p className="text-xs" style={{ color: 'var(--hub-primary)' }}>🔄 Domingo — regenerando para a próxima semana…</p>
        )}
        {isOutdated && plan && !loading && (
          <p className="text-xs" style={{ color: 'var(--hub-warning)' }}>⚠ Agenda de semana anterior — clique em "↺ Regenerar" para atualizar.</p>
        )}
        {!autoOn && (
          <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>
            Geração automática desligada — nada é criado no domingo nem pelo servidor. "Gerar agenda" continua funcionando quando você quiser.
          </p>
        )}
        {!hasRoutine && (
          <p className="text-xs" style={{ color: 'var(--hub-muted)' }}>
            Configure seus horários para uma agenda precisa.{' '}
            <Link to="/planner/rotina" className="font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-primary)' }}>Configurar rotina →</Link>
          </p>
        )}
        {error && <p className="text-xs" style={{ color: 'var(--hub-negative)' }}>✗ {error}</p>}

        {/* Stats */}
        {plan && !loading && (
          <div className="flex flex-wrap items-baseline gap-5">
            <Stat label="Sessões" value={String(totalSessions)} />
            <Stat label="Total" value={fmtMins(totalMin)} />
            {studyMin > 0 && <Stat label="Estudo" value={fmtMins(studyMin)} color="var(--hub-accent)" />}
            {trainMin > 0 && <Stat label="Treino" value={fmtMins(trainMin)} color="var(--hub-positive)" />}
            <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
              {new Date(plan.generatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Grade */}
        {loading ? (
          <p className="py-20 text-center text-sm" style={{ color: 'var(--hub-muted)' }}>Gerando agenda completa…</p>
        ) : !plan ? (
          <div className="py-20 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--hub-muted)' }}>Nenhuma agenda gerada</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              {hasRoutine ? 'Clique em "Gerar agenda".' : 'Configure sua rotina e clique em "Gerar agenda".'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: grade de 7 colunas fica ilegível numa tela estreita —
                agenda de um dia por vez, com seletor de dia acima. */}
            <div className="sm:hidden">
              <DayAgenda sessionsByDay={sessionsByDay} selectedDay={selectedDay} onSelectDay={setSelectedDay} todayIndex={todayIndex} />
            </div>

            {/* Desktop/tablet: grade completa da semana */}
            <div className="hidden overflow-hidden sm:block" style={{ borderRadius: 'var(--hub-radius-card)', background: 'var(--hub-card)', boxShadow: 'var(--hub-shadow-card)' }}>
              {/* Dias (sticky header) */}
              <div className="sticky top-0 z-10 flex" style={{ borderBottom: '1px solid var(--hub-border)', background: 'var(--hub-card)' }}>
                <div className="w-12 shrink-0" />
                {WEEK_DAYS.map((day, i) => {
                  const isToday = i === todayIndex;
                  const dayMin  = sessionsByDay[day].reduce((s, ss) => s + ss.durationMinutes, 0);
                  return (
                    <div key={day} className="min-w-0 flex-1 py-2.5 text-center" style={{ borderLeft: '1px solid var(--hub-border)', background: isToday ? 'rgba(193,99,61,0.05)' : undefined }}>
                      <p className="text-xs font-medium" style={{ color: isToday ? 'var(--hub-primary-strong)' : 'var(--hub-muted)' }}>{WEEK_DAY_SHORT[day]}</p>
                      {dayMin > 0 && <p className="mt-0.5 text-[9px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{fmtMins(dayMin)}</p>}
                      {isToday && <div className="mx-auto mt-0.5 h-1 w-1 rounded-full" style={{ background: 'var(--hub-primary)' }} />}
                    </div>
                  );
                })}
              </div>

              {/* Corpo */}
              <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '72vh' }}>
                <div className="flex" style={{ height: GRID_H }}>
                  <TimeGutter />
                  {WEEK_DAYS.map((day, i) => (
                    <div
                      key={day}
                      className="relative min-w-0 flex-1"
                      style={{ height: GRID_H, borderLeft: '1px solid var(--hub-border)', background: i === todayIndex ? 'rgba(193,99,61,0.03)' : undefined }}
                    >
                      <GridLines />
                      {i === todayIndex && <NowLine />}
                      {sessionsByDay[day].map((s) => (
                        <SessionBlock key={s.id} session={s} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap gap-3">
            {(Object.keys(TYPE_ACCENT) as SessionType[]).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--hub-muted)' }}>
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_ACCENT[t] }} />
                {TYPE_LABEL[t]}
              </span>
            ))}
          </div>
          <Link to="/planner/rotina" className="text-[11px] underline-offset-2 transition-opacity hover:underline hover:opacity-70" style={{ color: 'var(--hub-muted)' }}>
            Editar rotina
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs">
      <span style={{ color: 'var(--hub-muted)' }}>{label}</span>
      <span className="font-medium tabular-nums" style={{ color: color ?? 'var(--hub-text)' }}>{value}</span>
    </span>
  );
}
