import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { storageAdapter } from '../../core/storage/storage.adapter';
import { abinCheckInService, type AbinCheckIn } from '../../core/concurso/abinCheckInService';
import {
  abinTafService,
  type AbinTafType,
  type AbinTafLog,
  ABIN_TAF_LABEL,
  ABIN_TAF_REFERENCE,
} from '../../core/concurso/abinTafService';
import { BackButton } from '../../shared/ui';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type EditalAlert = { title: string; url: string; foundKeyword: string; detectedAt: string };
type EditalData  = { checkedAt: string | null; alerts: EditalAlert[] };
type PhaseData   = {
  checkedAt: string | null;
  milestoneIndex: number;
  milestoneLabel: string;
  evidence: string | null;
  studyPhaseRecommendation: number;
  summary: string | null;
};

type Milestone = { label: string; date: string };
type Phase = { id: number; title: string; period: string; subjects: string[] };

// ─── Dados estáticos ─────────────────────────────────────────────────────────

const MILESTONES: Milestone[] = [
  { label: 'Pedido protocolado no MGI', date: 'jun/2026' },
  { label: 'Aguardando autorização',    date: 'set/2026' },
  { label: 'Edital publicado',          date: '2027'     },
  { label: 'Provas realizadas',         date: '2027–2028'},
  { label: 'Nomeações',                 date: '2028'     },
];

const PHASES: Phase[] = [
  {
    id: 1,
    title: 'Fase 1 — Base Jurídica',
    period: 'ago/2026 – jan/2027',
    subjects: ['Direito Constitucional', 'Direito Administrativo', 'Raciocínio Lógico'],
  },
  {
    id: 2,
    title: 'Fase 2 — Conteúdo ABIN',
    period: 'fev/2027 – edital',
    subjects: ['Atividade de Inteligência', 'Legislação ABIN (SISBIN)', 'Inglês', 'Espanhol', 'Redação Discursiva'],
  },
  {
    id: 3,
    title: 'Fase 3 — Sprint pós-edital',
    period: 'após publicação do edital',
    subjects: ['Questões massivas por matéria', 'Simulados completos', 'Revisão por desempenho'],
  },
];

const PHASE_KEY = 'concurso.abin.currentPhase';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function formatWeek(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function isThisWeekFilled(): boolean {
  return abinCheckInService.getThisWeek() !== null;
}

function getSavedPhase(): number {
  try { return Number(storageAdapter.getItem<string>(PHASE_KEY)) || 1; } catch { return 1; }
}

function savePhase(p: number): void {
  try { storageAdapter.setItem(PHASE_KEY, String(p)); } catch { /* noop */ }
}

// ─── Gráfico de evolução SVG ──────────────────────────────────────────────────

function CheckInChart({ checkIns }: { checkIns: AbinCheckIn[] }) {
  const data = checkIns.slice(0, 10).reverse(); // mais antigo primeiro
  if (data.length < 2) return null;

  const W = 300; const H = 80; const PAD = 6;
  const maxH = Math.max(...data.map((c) => c.hoursStudied), 1);
  const pts = data.map((c, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((c.hoursStudied / maxH) * (H - PAD * 2)),
    acc: c.accuracyPct,
    h: c.hoursStudied,
    week: c.weekStart,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  function dotColor(acc: number): string {
    if (acc === 0) return 'var(--hub-subtle)';
    if (acc >= 70) return 'var(--hub-positive)';
    if (acc >= 50) return 'var(--hub-warning)';
    return 'var(--hub-negative)';
  }

  return (
    <div>
      <p className="mb-2 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.12em', color: 'var(--hub-subtle)' }}>Horas estudadas por semana</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        <path d={pathD} fill="none" stroke="var(--hub-accent)" strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={dotColor(p.acc)} />
            <title>{formatWeek(p.week)}: {p.h}h {p.acc > 0 ? `· ${p.acc}%` : ''}</title>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px]" style={{ color: 'var(--hub-subtle)' }}>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--hub-positive)' }} />≥70%</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--hub-warning)' }} />50–69%</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--hub-negative)' }} />&lt;50%</span>
        <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--hub-subtle)' }} />sem questões</span>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ConcursoAbinPage() {
  const [edital, setEdital]         = useState<EditalData | null>(null);
  const [phaseData, setPhaseData]   = useState<PhaseData | null>(null);
  const [currentPhase, setCurrentPhaseState] = useState(() => getSavedPhase());
  const [openPhase, setOpenPhase]         = useState<number | null>(currentPhase);
  const [checkIns, setCheckIns]           = useState<AbinCheckIn[]>(() => abinCheckInService.list());
  const [showCheckInForm, setShowCheckInForm] = useState(!isThisWeekFilled());

  // check-in form
  const [hours, setHours]         = useState('');
  const [questions, setQuestions] = useState('');
  const [accuracy, setAccuracy]   = useState('');
  const [trained, setTrained]     = useState(false);
  const [note, setNote]           = useState('');
  const [saving, setSaving]       = useState(false);

  // TAF state
  const [tafLogs, setTafLogs]         = useState<AbinTafLog[]>(() => abinTafService.list());
  const [showTafForm, setShowTafForm] = useState(false);
  const [tafType, setTafType]         = useState<AbinTafType>('run12min');
  const [tafDate, setTafDate]         = useState(() => new Date().toISOString().split('T')[0]);
  const [tafDist, setTafDist]         = useState('');
  const [tafNote, setTafNote]         = useState('');

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/abin-alerts.json')
      .then((r) => r.json())
      .then((d: EditalData) => setEdital(d))
      .catch(() => setEdital({ checkedAt: null, alerts: [] }));

    fetch('/abin-phase.json')
      .then((r) => r.json())
      .then((d: PhaseData) => {
        setPhaseData(d);
        // Auto-atualiza fase de estudo se o monitor detectou mudança
        if (d.studyPhaseRecommendation && d.studyPhaseRecommendation !== getSavedPhase()) {
          // Só sugere, não muda automaticamente (banner abaixo)
        }
      })
      .catch(() => {});
  }, []);

  function setCurrentPhase(p: number) {
    setCurrentPhaseState(p);
    setOpenPhase(p);
    savePhase(p);
  }

  function handleSaveCheckIn() {
    if (!hours) return;
    setSaving(true);
    abinCheckInService.save({
      hoursStudied: Number(hours),
      questionsResolved: Number(questions) || 0,
      accuracyPct: Number(accuracy) || 0,
      trainingDone: trained,
      note,
    });
    setCheckIns(abinCheckInService.list());
    setShowCheckInForm(false);
    setSaving(false);
    setHours(''); setQuestions(''); setAccuracy(''); setTrained(false); setNote('');
  }

  function handleSaveTaf() {
    if (!tafDist) return;
    abinTafService.add({ date: tafDate, type: tafType, distanceMeters: Number(tafDist), note: tafNote });
    setTafLogs(abinTafService.list());
    setShowTafForm(false);
    setTafDist(''); setTafNote('');
  }

  const tafTypes: AbinTafType[] = ['swimming', 'run12min'];

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <BackButton />
      <div className="flex items-center gap-3">
        <span className="text-3xl">🕵️</span>
        <div>
          <h1 className="text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>Concurso ABIN</h1>
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Agência Brasileira de Inteligência — Oficial de Inteligência</p>
        </div>
      </div>

      {/* ── Timeline de marcos ───────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Cronograma</h2>
          {phaseData?.checkedAt && (
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
              IA: {formatDate(phaseData.checkedAt)}
            </span>
          )}
        </div>

        {/* Banner de fase detectada pela IA */}
        {phaseData?.summary && (
          <div className="mb-4" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 50%, transparent)', paddingLeft: '12px' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--hub-accent)' }}>🤖 Detecção automática</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-muted)' }}>{phaseData.summary}</p>
            {phaseData.evidence && (
              <p className="mt-1 text-[10px] italic" style={{ color: 'var(--hub-subtle)' }}>Evidência: {phaseData.evidence.slice(0, 120)}…</p>
            )}
            {phaseData.studyPhaseRecommendation !== currentPhase && (
              <button
                onClick={() => setCurrentPhase(phaseData.studyPhaseRecommendation)}
                className="mt-2 text-xs underline transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Aplicar fase de estudo recomendada (F{phaseData.studyPhaseRecommendation}) →
              </button>
            )}
          </div>
        )}

        <ol className="relative space-y-5 pl-6" style={{ borderLeft: '1px solid var(--hub-border)' }}>
          {MILESTONES.map((m, i) => {
            const activeIdx = phaseData?.milestoneIndex ?? 1;
            const done    = i < activeIdx;
            const current = i === activeIdx;
            return (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[1.625rem] flex h-5 w-5 items-center justify-center rounded-full"
                  style={{
                    border: `1.5px solid ${done || current ? 'var(--hub-accent)' : 'var(--hub-border-strong)'}`,
                    background: done ? 'var(--hub-accent)' : 'var(--hub-bg)',
                  }}
                >
                  {done && <span className="text-[10px] text-white">✓</span>}
                  {current && <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--hub-accent)' }} />}
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: current ? 'var(--hub-accent)' : done ? 'var(--hub-subtle)' : 'var(--hub-text-body)',
                      textDecoration: done ? 'line-through' : undefined,
                    }}
                  >
                    {m.label}
                  </p>
                  <span className="shrink-0 text-xs font-medium" style={{ color: current ? 'var(--hub-accent)' : 'var(--hub-subtle)' }}>
                    {m.date}
                  </span>
                </div>
                {current && <p className="mt-0.5 text-xs" style={{ color: 'color-mix(in srgb, var(--hub-accent) 70%, transparent)' }}>Em andamento</p>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Plano de estudo por fases ────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Plano de Estudo</h2>
          {/* Seletor de fase atual */}
          <div className="flex gap-1">
            {PHASES.map((p) => (
              <button
                key={p.id}
                onClick={() => setCurrentPhase(p.id)}
                title={`Definir como fase atual: ${p.title}`}
                className={`hub-tab${currentPhase === p.id ? ' active' : ''}`}
                type="button"
              >
                F{p.id}
              </button>
            ))}
          </div>
        </div>
        <div>
          {PHASES.map((phase) => (
            <div key={phase.id} style={{ borderBottom: '1px solid var(--hub-border)' }}>
              <button
                onClick={() => setOpenPhase(openPhase === phase.id ? null : phase.id)}
                className="flex w-full items-center justify-between py-3.5 text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <div className="flex items-center gap-2">
                  {currentPhase === phase.id && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--hub-accent)' }} />
                  )}
                  <div>
                    <p className="text-sm font-medium" style={{ color: currentPhase === phase.id ? 'var(--hub-accent)' : 'var(--hub-text)' }}>{phase.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>{phase.period}</p>
                  </div>
                </div>
                <span className="transition-transform" style={{ color: 'var(--hub-subtle)', transform: openPhase === phase.id ? 'rotate(180deg)' : undefined }}>▾</span>
              </button>
              {openPhase === phase.id && (
                <div className="pb-4 pl-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {phase.subjects.map((s) => (
                      <span key={s} className="text-xs" style={{ color: 'var(--hub-text-body)' }}>{s}</span>
                    ))}
                  </div>
                  {/* `?tag=` substituiu `?secao=concurso&fonte=abin`: a escolha da
                      fonte deixou de ser navegação e virou um campo, então basta
                      dizer a matéria. Vai na primeira da fase, já pré-selecionada. */}
                  <Link
                    to={`/estudos/questoes/gerar?tag=${encodeURIComponent(phase.subjects[0] ?? '')}`}
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-accent)' }}
                  >
                    Gerar questões dessas matérias →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── TAF ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Aptidão Física (TAF)</h2>
          <button
            onClick={() => setShowTafForm((v) => !v)}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showTafForm ? 'Cancelar' : '+ Registrar treino'}
          </button>
        </div>

        {/* Cards de progresso */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-4">
          {tafTypes.map((type) => {
            const best = abinTafService.getBest(type);
            const ref = ABIN_TAF_REFERENCE[type];
            const pct = best !== null ? Math.min(100, Math.round((best / ref.distance) * 100)) : 0;
            const color = pct >= 100 ? 'var(--hub-positive)' : pct >= 70 ? 'var(--hub-warning)' : 'var(--hub-negative)';
            return (
              <div key={type} className="py-2">
                <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{ABIN_TAF_LABEL[type]}</p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>Ref: {ref.label}</p>
                {best !== null ? (
                  <>
                    <p className="mt-2 text-xl tabular-nums" style={{ fontWeight: 300, color }}>
                      {best}m
                    </p>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
                      <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color, opacity: 0.7 }} />
                    </div>
                    <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{pct}% do mínimo estimado</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>Sem registros</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Formulário de log TAF */}
        {showTafForm && (
          <div className="mt-4 space-y-3" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 50%, transparent)', paddingLeft: '14px' }}>
            <div className="flex gap-1">
              {tafTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setTafType(t)}
                  className={`hub-tab${tafType === t ? ' active' : ''}`}
                  type="button"
                >
                  {ABIN_TAF_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Data</span>
                <input type="date" value={tafDate} onChange={(e) => setTafDate(e.target.value)} className="w-full text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Distância (metros)</span>
                <input type="number" min="0" value={tafDist} onChange={(e) => setTafDist(e.target.value)}
                  placeholder={tafType === 'swimming' ? 'ex: 250' : 'ex: 2200'} className="w-full text-sm" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Nota (opcional)</span>
              <input value={tafNote} onChange={(e) => setTafNote(e.target.value)} placeholder="Como foi o treino?" className="w-full text-sm" />
            </label>
            <button onClick={handleSaveTaf} disabled={!tafDist}
              className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Salvar treino
            </button>
          </div>
        )}

        {/* Histórico TAF recente */}
        {tafLogs.length > 0 && (
          <div className="mt-3">
            {tafLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{log.date}</span>
                  <span className="text-xs" style={{ color: 'var(--hub-muted)' }}>{ABIN_TAF_LABEL[log.type]}</span>
                  <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--hub-accent)' }}>{log.distanceMeters}m</span>
                </div>
                <div className="flex items-center gap-2">
                  {log.note && <span className="max-w-20 truncate text-[10px]" style={{ color: 'var(--hub-subtle)' }}>{log.note}</span>}
                  <button onClick={() => { abinTafService.delete(log.id); setTafLogs(abinTafService.list()); }}
                    className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>
          Distâncias mínimas serão definidas no edital (previsto 2027). Valores de referência são estimativas.
        </p>
      </section>

      {/* ── Monitor de Edital ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Monitor de Edital</h2>
        {edital === null ? (
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Carregando…</p>
        ) : edital.alerts.length > 0 ? (
          <div>
            {edital.alerts.map((alert, i) => (
              <div key={i} className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--hub-negative)' }}>{alert.title}</p>
                <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                  Palavra-chave: {alert.foundKeyword} · {formatDate(alert.detectedAt)}
                </p>
                <a href={alert.url} target="_blank" rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs underline transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)' }}>Ver fonte →</a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
            {edital.checkedAt
              ? `Nenhuma novidade. Verificado em ${formatDate(edital.checkedAt)}.`
              : 'Monitor ABIN ativo. Verificação diária às 08h.'}
          </p>
        )}
      </section>

      {/* ── Check-in Semanal ─────────────────────────────────────────────── */}
      <section ref={formRef}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>Check-in Semanal</h2>
          {!showCheckInForm && (
            <button onClick={() => setShowCheckInForm(true)} className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {isThisWeekFilled() ? 'Editar semana atual' : '+ Nova semana'}
            </button>
          )}
        </div>

        {checkIns.length >= 2 && <CheckInChart checkIns={checkIns} />}

        {showCheckInForm && (
          <div className="mt-4 space-y-4" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 50%, transparent)', paddingLeft: '14px' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--hub-accent)' }}>
              Semana de {formatWeek(getMonday(new Date()))}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Horas estudadas</span>
                <input type="number" min="0" max="168" step="0.5" value={hours}
                  onChange={(e) => setHours(e.target.value)} placeholder="ex: 12" className="w-full text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Questões resolvidas</span>
                <input type="number" min="0" value={questions}
                  onChange={(e) => setQuestions(e.target.value)} placeholder="ex: 80" className="w-full text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Aproveitamento (%)</span>
                <input type="number" min="0" max="100" value={accuracy}
                  onChange={(e) => setAccuracy(e.target.value)} placeholder="ex: 72" className="w-full text-sm" />
              </label>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={trained} onChange={(e) => setTrained(e.target.checked)}
                    className="h-4 w-4" style={{ accentColor: 'var(--hub-accent)' }} />
                  <span className="text-sm" style={{ color: 'var(--hub-text-body)' }}>Treino físico feito</span>
                </label>
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block" style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}>Nota pessoal</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Como foi a semana? Dificuldades, acertos..." className="w-full resize-none text-sm" />
            </label>
            <div className="flex items-baseline gap-5">
              <button onClick={handleSaveCheckIn} disabled={!hours || saving}
                className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {saving ? 'Salvando…' : 'Salvar check-in'}
              </button>
              <button onClick={() => setShowCheckInForm(false)}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {checkIns.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhum check-in registrado ainda.</p>
        ) : (
          <div className="mt-3">
            {checkIns.map((ci) => (
              <div key={ci.id} className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium" style={{ color: 'var(--hub-muted)' }}>{formatWeek(ci.weekStart)}</p>
                  <div className="flex items-center gap-3 text-xs">
                    {ci.trainingDone && <span style={{ color: 'var(--hub-positive)' }}>🏃 Treinou</span>}
                    <button onClick={() => { abinCheckInService.delete(ci.id); setCheckIns(abinCheckInService.list()); }}
                      className="transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <span style={{ color: 'var(--hub-text-body)' }}>
                    <span className="font-medium tabular-nums" style={{ color: 'var(--hub-accent)' }}>{ci.hoursStudied}h</span> estudadas
                  </span>
                  {ci.questionsResolved > 0 && (
                    <span style={{ color: 'var(--hub-text-body)' }}>
                      <span className="font-medium tabular-nums" style={{ color: 'var(--hub-accent)' }}>{ci.questionsResolved}</span> questões
                      {ci.accuracyPct > 0 && (
                        <span className="ml-1 font-medium tabular-nums" style={{ color: ci.accuracyPct >= 70 ? 'var(--hub-positive)' : ci.accuracyPct >= 50 ? 'var(--hub-warning)' : 'var(--hub-negative)' }}>
                          ({ci.accuracyPct}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
                {ci.note && <p className="mt-1.5 text-xs italic" style={{ color: 'var(--hub-subtle)' }}>"{ci.note}"</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <Link
        to="/estudos/questoes/gerar"
        className="inline-block text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-accent)' }}
      >
        📚 Gerar questões ABIN →
      </Link>
    </div>
  );
}
