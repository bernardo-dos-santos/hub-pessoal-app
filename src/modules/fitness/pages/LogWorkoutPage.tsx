import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workoutService } from '../services/workoutService';
import { tafService } from '../services/tafService';
import { aiWorkoutFeedbackService, type WorkoutFeedback } from '../services/aiWorkoutFeedbackService';
import { type WorkoutType } from '../types/workout';
import { Card, Button, Eyebrow } from '../../../shared/ui';

const WORKOUT_TYPES: { type: WorkoutType; label: string; emoji: string }[] = [
  { type: 'running',  label: 'Corrida',    emoji: '🏃' },
  { type: 'sit_up',   label: 'Abdominal',  emoji: '💪' },
  { type: 'push_up',  label: 'Flexão',     emoji: '🤸' },
  { type: 'pull_up',  label: 'Barra',      emoji: '🏋️' },
  { type: 'strength', label: 'Musculação', emoji: '🏆' },
  { type: 'other',    label: 'Outro',      emoji: '⚡' },
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

const inputClass =
  'w-full bg-transparent pb-1.5 text-sm outline-none transition-colors';
const inputStyle = { borderBottom: '1px solid var(--hub-border-strong)', color: 'var(--hub-text)' };
const labelStyle = { color: 'var(--hub-label)' };

const trendColor: Record<string, string> = {
  improving: 'var(--hub-positive)',
  steady:    'var(--hub-accent)',
  declining: 'var(--hub-warning)',
  first:     'var(--hub-mauve)',
};

export function LogWorkoutPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<WorkoutType | null>(null);
  const [date, setDate] = useState(todayISO());
  const [distance, setDistance] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState<WorkoutFeedback | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const isRunning = selected === 'running';
  const isReps = selected && ['sit_up', 'push_up', 'pull_up'].includes(selected);

  async function handleSave() {
    if (!selected) return;

    const totalSeconds =
      minutes ? parseInt(minutes) * 60 + (parseInt(seconds) || 0) : undefined;
    const dist = distance ? parseInt(distance) : undefined;
    const pace =
      dist && totalSeconds ? Math.round(totalSeconds / (dist / 1000)) : undefined;

    const previous = workoutService.getLastByType(selected);

    const savedWorkout = workoutService.create({
      type: selected,
      date,
      distanceMeters: dist,
      durationSeconds: totalSeconds,
      paceSecondsPerKm: pace,
      reps: reps ? parseInt(reps) : undefined,
      sets: sets ? parseInt(sets) : undefined,
      notes: notes.trim() || undefined,
    });

    setSaved(true);
    setLoadingFeedback(true);

    const tafResults = tafService.getAllTestResults();
    const tafResult = tafResults.find((r) => r.requirement.workoutType === selected) ?? null;

    try {
      const fb = await aiWorkoutFeedbackService.getFeedback(savedWorkout, previous, tafResult);
      setFeedback(fb);
    } catch {
      setFeedback({ message: 'Treino registrado! Continue evoluindo rumo ao CBMSC.', trend: 'steady' });
    } finally {
      setLoadingFeedback(false);
    }
  }

  if (saved) {
    return (
      <Card className="text-center">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <span className="text-5xl">✅</span>
          <p className="text-lg font-semibold" style={{ color: 'var(--hub-positive)' }}>Treino registrado!</p>
          {loadingFeedback && (
            <p className="text-sm animate-pulse" style={{ color: 'var(--hub-muted)' }}>
              Gerando feedback da IA…
            </p>
          )}
          {feedback && (
            <div className="mt-2 w-full px-1 py-4 text-left" style={{ borderTop: '1px solid var(--hub-border)' }}>
              <Eyebrow style={{ marginBottom: '4px' }}>Coach CBMSC</Eyebrow>
              <p className="text-sm leading-relaxed" style={{ color: trendColor[feedback.trend] ?? 'var(--hub-text)' }}>
                {feedback.message}
              </p>
            </div>
          )}
          <Button variant="secondary" onClick={() => navigate('/treino')} className="mt-2">
            Ver histórico →
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {/* Tipo */}
      <Eyebrow style={{ marginBottom: '14px' }}>Tipo de treino</Eyebrow>
      <div className="grid grid-cols-3 gap-2">
        {WORKOUT_TYPES.map(({ type, label, emoji }) => {
          const active = selected === type;
          return (
            <button
              key={type}
              onClick={() => setSelected(type)}
              className="flex flex-col items-center gap-1.5 py-3 text-xs font-medium transition-colors"
              style={{
                borderRadius: '14px',
                cursor: 'pointer',
                background: active ? 'rgba(193,99,61,0.12)' : 'transparent',
                color: active ? 'var(--hub-primary-strong)' : 'var(--hub-muted)',
                border: `1px solid ${active ? 'rgba(193,99,61,0.30)' : 'var(--hub-border)'}`,
              }}
            >
              <span className="text-2xl">{emoji}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Form contextual */}
      {selected && (
        <div className="mt-6 space-y-5" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '20px' }}>
          {isRunning && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Distância (metros)</label>
                <input type="number" placeholder="ex: 2800" value={distance} onChange={(e) => setDistance(e.target.value)} className={`${inputClass} text-lg font-semibold`} style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Minutos</label>
                  <input type="number" placeholder="12" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputClass} text-lg font-semibold`} style={inputStyle} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Segundos</label>
                  <input type="number" placeholder="00" value={seconds} onChange={(e) => setSeconds(e.target.value)} className={`${inputClass} text-lg font-semibold`} style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {isReps && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Repetições</label>
                <input type="number" placeholder="ex: 35" value={reps} onChange={(e) => setReps(e.target.value)} className={`${inputClass} text-lg font-semibold`} style={inputStyle} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Séries (opcional)</label>
                <input type="number" placeholder="ex: 3" value={sets} onChange={(e) => setSets(e.target.value)} className={`${inputClass} text-lg font-semibold`} style={inputStyle} />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} text-sm`} style={inputStyle} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={labelStyle}>Notas (opcional)</label>
            <input type="text" placeholder="ex: Cansado, calor 30°C" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} text-sm`} style={inputStyle} />
          </div>

          <Button variant="primary" onClick={handleSave} className="w-full" style={{ marginTop: '4px' }}>
            Salvar treino
          </Button>
        </div>
      )}
    </Card>
  );
}
