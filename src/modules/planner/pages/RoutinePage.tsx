import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { routineService } from '../services/routineService';
import { ModuleHeader, type ModuleTab, Card, Button, Select } from '../../../shared/ui';
import {
  type DayRoutine,
  type Routine,
  type TimeBlock,
  type ActivityType,
  WEEK_DAYS,
  WEEK_DAY_LABEL,
  ACTIVITY_LABEL,
  PLANNABLE_ACTIVITIES,
} from '../types/routine';

const PLANNER_TABS: ModuleTab[] = [
  { label: 'Plano semanal', to: '/planner', end: true },
  { label: 'Rotina',        to: '/planner/rotina' },
];

const TIME_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

const ACTIVITY_OPTIONS: ActivityType[] = [
  'free', 'study', 'college', 'gym', 'work', 'meal', 'commute', 'rest', 'personal',
];

const ACTIVITY_COLOR: Record<ActivityType, string> = {
  free:     'var(--hub-accent)',
  study:    'var(--hub-positive)',
  college:  'var(--hub-mauve)',
  gym:      'var(--hub-warning)',
  work:     'var(--hub-neutral)',
  meal:     'var(--hub-progress)',
  commute:  'var(--hub-subtle)',
  rest:     'var(--hub-subtle)',
  personal: 'var(--hub-muted)',
};

const selCls = 'text-xs bg-transparent pb-0.5 outline-none cursor-pointer appearance-none transition-colors';

function blockDuration(block: TimeBlock): string {
  const [sh, sm] = block.start.split(':').map(Number);
  const [eh, em] = block.end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

export function RoutinePage() {
  const navigate = useNavigate();
  const [days, setDays] = useState<DayRoutine[]>(() => routineService.getRoutine().days);
  const [saved, setSaved] = useState(false);
  const [copyMenuFor, setCopyMenuFor] = useState<number | null>(null);

  useEffect(() => {
    if (copyMenuFor === null) return;
    function handle(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-copy-menu]')) setCopyMenuFor(null);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [copyMenuFor]);

  function updateDay(index: number, patch: Partial<DayRoutine>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setSaved(false);
  }

  function addBlock(dayIndex: number) {
    const day = days[dayIndex];
    const lastBlock = day.blocks[day.blocks.length - 1];
    const newStart = lastBlock?.end ?? '19:00';
    const [h, m] = newStart.split(':').map(Number);
    const endMins = h * 60 + m + 60;
    const endH = Math.min(Math.floor(endMins / 60), 23);
    const endM = endMins % 60;
    const newEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    const newBlock: TimeBlock = { start: newStart, end: newEnd, activity: 'free' };
    updateDay(dayIndex, { blocks: [...day.blocks, newBlock] });
  }

  function updateBlock(dayIndex: number, blockIndex: number, patch: Partial<TimeBlock>) {
    const blocks = days[dayIndex].blocks.map((b, i) => (i === blockIndex ? { ...b, ...patch } : b));
    updateDay(dayIndex, { blocks });
  }

  function removeBlock(dayIndex: number, blockIndex: number) {
    const blocks = days[dayIndex].blocks.filter((_, i) => i !== blockIndex);
    updateDay(dayIndex, { blocks });
  }

  function copyDayTo(fromIdx: number, toIndices: number[]) {
    const src = days[fromIdx];
    setDays((prev) =>
      prev.map((d, i) =>
        toIndices.includes(i) && i !== fromIdx
          ? { ...d, blocks: src.blocks.map((b) => ({ ...b })), wakeTime: src.wakeTime, sleepTime: src.sleepTime, available: true }
          : d,
      ),
    );
    setSaved(false);
    setCopyMenuFor(null);
  }

  function handleSave() {
    const routine: Routine = { days, updatedAt: new Date().toISOString() };
    routineService.saveRoutine(routine);
    setSaved(true);
  }

  const freeMinutes = days
    .filter((d) => d.available)
    .flatMap((d) => d.blocks.filter((b) => !b.activity || PLANNABLE_ACTIVITIES.has(b.activity)))
    .reduce((sum, b) => {
      const [sh, sm] = b.start.split(':').map(Number);
      const [eh, em] = b.end.split(':').map(Number);
      return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }, 0);
  const freeH = Math.floor(freeMinutes / 60);
  const freeM = freeMinutes % 60;

  const eyeStyle = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--hub-label)' };

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Planejamento" title="Planner" tabs={PLANNER_TABS} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Registre sua rotina completa — faculdade, treino, refeições, tempo livre. O JARVIS e o plano semanal usam esses dados para entender sua agenda.
      </p>

      {/* Legenda */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {ACTIVITY_OPTIONS.map((act) => (
          <span key={act} className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: ACTIVITY_COLOR[act] }}>
            {ACTIVITY_LABEL[act]}
          </span>
        ))}
      </div>

      <Card>
        {WEEK_DAYS.map((day, i) => {
          const d = days[i];
          return (
            <div
              key={day}
              style={{ borderBottom: i === WEEK_DAYS.length - 1 ? 'none' : '1px solid var(--hub-border)', opacity: d.available ? 1 : 0.5 }}
            >
              {/* Cabeçalho do dia */}
              <div className="flex items-center gap-3 py-3">
                <button
                  type="button"
                  onClick={() => updateDay(i, {
                    available: !d.available,
                    blocks: !d.available && d.blocks.length === 0
                      ? [{ start: '19:00', end: '21:00', activity: 'free' }]
                      : d.blocks,
                  })}
                  className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                  style={{ background: d.available ? 'var(--hub-primary)' : 'rgba(58,44,34,0.15)', border: 'none', cursor: 'pointer' }}
                  aria-label={`${WEEK_DAY_LABEL[day]} ${d.available ? 'disponível' : 'indisponível'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-transform ${d.available ? 'left-4' : 'left-0.5'}`} style={{ background: '#FFF8F0' }} />
                </button>

                <span className="w-20 text-sm font-medium" style={{ color: d.available ? 'var(--hub-text)' : 'var(--hub-muted)' }}>
                  {WEEK_DAY_LABEL[day]}
                </span>

                {d.available && (
                  <div className="flex items-center gap-3 ml-auto">
                    {d.wakeTime && <span className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>acorda {d.wakeTime}</span>}
                    {d.sleepTime && <span className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>dorme {d.sleepTime}</span>}
                    <div className="relative" data-copy-menu>
                      <button
                        type="button"
                        onClick={() => setCopyMenuFor(copyMenuFor === i ? null : i)}
                        className="text-[10px] font-semibold uppercase tracking-[0.08em] transition-opacity hover:opacity-70"
                        style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Copiar
                      </button>
                      {copyMenuFor === i && (
                        <div
                          className="absolute right-0 top-5 z-10 min-w-[160px]"
                          style={{ background: 'var(--hub-card)', border: '1px solid var(--hub-border-strong)', borderRadius: '14px', boxShadow: 'var(--hub-shadow-menu)', padding: '8px' }}
                        >
                          <button
                            type="button"
                            onClick={() => copyDayTo(i, [1, 2, 3, 4, 5])}
                            className="block w-full text-left text-xs font-medium py-1 px-2 transition-opacity hover:opacity-70"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-primary)' }}
                          >
                            Dias úteis (Seg–Sex)
                          </button>
                          <div style={{ borderBottom: '1px solid var(--hub-border)', margin: '4px 0' }} />
                          {WEEK_DAYS.map((wd, ti) => {
                            if (ti === i) return null;
                            return (
                              <button
                                key={wd}
                                type="button"
                                onClick={() => copyDayTo(i, [ti])}
                                className="block w-full text-left text-xs py-1 px-2 transition-opacity hover:opacity-70"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-text-body)' }}
                              >
                                {WEEK_DAY_LABEL[wd]}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!d.available && <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Indisponível</span>}
              </div>

              {/* Corpo do dia */}
              {d.available && (
                <div className="pb-4 pl-12 space-y-1">
                  <div className="flex items-baseline gap-6 mb-3">
                    <label className="flex items-baseline gap-2">
                      <span style={eyeStyle}>Acorda</span>
                      <Select value={d.wakeTime ?? ''} onChange={(value) => updateDay(i, { wakeTime: value || undefined })} className={selCls}>
                        <Select.Option value="">--</Select.Option>
                        {TIME_OPTIONS.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                      </Select>
                    </label>
                    <label className="flex items-baseline gap-2">
                      <span style={eyeStyle}>Dorme</span>
                      <Select value={d.sleepTime ?? ''} onChange={(value) => updateDay(i, { sleepTime: value || undefined })} className={selCls}>
                        <Select.Option value="">--</Select.Option>
                        {TIME_OPTIONS.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                      </Select>
                    </label>
                  </div>

                  {d.blocks.map((block, bi) => {
                    const dur = blockDuration(block);
                    const act = block.activity ?? 'free';
                    const color = ACTIVITY_COLOR[act];
                    return (
                      <div key={bi} className="flex items-baseline gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 self-center" style={{ background: color }} />
                        <Select value={block.start} onChange={(value) => updateBlock(i, bi, { start: value })} className={`w-16 ${selCls}`}>
                          {TIME_OPTIONS.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                        </Select>
                        <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>–</span>
                        <Select value={block.end} onChange={(value) => updateBlock(i, bi, { end: value })} className={`w-16 ${selCls}`}>
                          {TIME_OPTIONS.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                        </Select>
                        <Select value={act} onChange={(value) => updateBlock(i, bi, { activity: value as ActivityType })} className={selCls}>
                          {ACTIVITY_OPTIONS.map((a) => <Select.Option key={a} value={a}>{ACTIVITY_LABEL[a]}</Select.Option>)}
                        </Select>
                        {dur && <span className="text-[10px] tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{dur}</span>}
                        <button type="button" onClick={() => removeBlock(i, bi)} className="ml-auto text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  <div className="pt-1">
                    <button type="button" onClick={() => addBlock(i)} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      + Adicionar bloco
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Resumo */}
      <p className="mt-5 text-xs" style={{ color: 'var(--hub-muted)' }}>
        Tempo livre disponível para o plano:{' '}
        <span className="font-medium tabular-nums" style={{ color: 'var(--hub-text)' }}>
          {freeH > 0 || freeM > 0 ? `${freeH > 0 ? `${freeH}h` : ''}${freeM > 0 ? ` ${freeM}min` : ''}` : '—'}
        </span>{' '}
        por semana
        <span style={{ color: 'var(--hub-subtle)' }}> (blocos Livre e Estudo)</span>
      </p>

      {/* Ações */}
      <div className="mt-8 flex items-baseline gap-6">
        <Button variant="text" onClick={handleSave}>Salvar rotina</Button>
        <Button variant="secondary" onClick={() => navigate('/planner/plano-semanal')}>Ver plano semanal</Button>
      </div>

      {saved && (
        <p className="mt-5 text-sm" style={{ color: 'var(--hub-positive)' }}>
          Rotina salva. O plano semanal e o JARVIS já usam esses dados.
        </p>
      )}
    </div>
  );
}
