import { useState } from 'react';
import { Link } from 'react-router-dom';
import { workoutService } from '../services/workoutService';
import { type Workout, type WorkoutType } from '../types/workout';
import { Card } from '../../../shared/ui';

const typeLabel: Record<WorkoutType, string> = {
  running:  'Corrida',
  sit_up:   'Abdominal',
  push_up:  'Flexão',
  pull_up:  'Barra',
  swimming: 'Natação',
  strength: 'Musculação',
  other:    'Outro',
};

const typeEmoji: Record<WorkoutType, string> = {
  running:  '🏃',
  sit_up:   '💪',
  push_up:  '🤸',
  pull_up:  '🏋️',
  swimming: '🏊',
  strength: '🏆',
  other:    '⚡',
};

function workoutValue(workout: Workout): string {
  if (workout.distanceMeters) {
    const dist = `${workout.distanceMeters}m`;
    if (workout.durationSeconds) {
      const min = Math.floor(workout.durationSeconds / 60);
      const sec = (workout.durationSeconds % 60).toString().padStart(2, '0');
      return `${dist} · ${min}:${sec}`;
    }
    return dist;
  }
  if (workout.reps) {
    return workout.sets ? `${workout.sets}×${workout.reps} reps` : `${workout.reps} reps`;
  }
  return '—';
}

function shortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const inputClass = 'w-full bg-transparent pb-1.5 text-sm outline-none transition-colors';
const inputStyle = { borderBottom: '1px solid var(--hub-border-strong)', color: 'var(--hub-text)' };

export function WorkoutLogPage() {
  const [workouts, setWorkouts] = useState(() => workoutService.listWorkouts());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function refresh() {
    setWorkouts(workoutService.listWorkouts());
  }

  function handleDelete(id: string) {
    workoutService.delete(id);
    setConfirmId(null);
    refresh();
  }

  if (workouts.length === 0) {
    return (
      <Card className="text-center">
        <div className="py-10">
          <p style={{ color: 'var(--hub-muted)' }}>Nenhum treino registrado ainda.</p>
          <Link
            to="/treino/registrar"
            className="mt-4 inline-block text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-primary)' }}
          >
            Registrar primeiro treino →
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {workouts.map((workout, i) =>
        editingId === workout.id ? (
          <EditWorkoutCard
            key={workout.id}
            workout={workout}
            onCancel={() => setEditingId(null)}
            onSave={(patch) => {
              workoutService.update(workout.id, patch);
              setEditingId(null);
              refresh();
            }}
          />
        ) : (
          <div
            key={workout.id}
            style={{ padding: '13px 0', borderBottom: i === workouts.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{typeEmoji[workout.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--hub-text)' }}>
                  {typeLabel[workout.type]}
                </p>
                <p className="text-xs tabular-nums" style={{ color: 'var(--hub-muted)' }}>
                  {workoutValue(workout)}
                </p>
                {workout.notes && (
                  <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--hub-subtle)' }}>
                    {workout.notes}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                {shortDate(workout.date)}
              </p>
            </div>

            {confirmId === workout.id ? (
              <div className="mt-3 flex items-center justify-end gap-3 pt-2" style={{ borderTop: '1px solid var(--hub-border)' }}>
                <span className="mr-auto text-xs" style={{ color: 'var(--hub-negative)' }}>Excluir este treino?</span>
                <button onClick={() => handleDelete(workout.id)} className="text-xs font-bold transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Excluir
                </button>
                <button onClick={() => setConfirmId(null)} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-end gap-4 pt-2" style={{ borderTop: '1px solid var(--hub-border)' }}>
                <button onClick={() => { setEditingId(workout.id); setConfirmId(null); }} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Editar
                </button>
                <button onClick={() => setConfirmId(workout.id)} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Excluir
                </button>
              </div>
            )}
          </div>
        ),
      )}
    </Card>
  );
}

type EditPatch = Partial<Omit<Workout, 'id' | 'createdAt'>>;

function EditWorkoutCard({ workout, onSave, onCancel }: { workout: Workout; onSave: (patch: EditPatch) => void; onCancel: () => void }) {
  const isRunning = workout.type === 'running';
  const isReps = ['sit_up', 'push_up', 'pull_up'].includes(workout.type);

  const [date, setDate] = useState(workout.date);
  const [distance, setDistance] = useState(workout.distanceMeters?.toString() ?? '');
  const [minutes, setMinutes] = useState(workout.durationSeconds ? Math.floor(workout.durationSeconds / 60).toString() : '');
  const [seconds, setSeconds] = useState(workout.durationSeconds ? (workout.durationSeconds % 60).toString() : '');
  const [reps, setReps] = useState(workout.reps?.toString() ?? '');
  const [sets, setSets] = useState(workout.sets?.toString() ?? '');
  const [notes, setNotes] = useState(workout.notes ?? '');

  function save() {
    const totalSeconds = minutes ? parseInt(minutes) * 60 + (parseInt(seconds) || 0) : undefined;
    onSave({
      date,
      distanceMeters: distance ? parseInt(distance) : undefined,
      durationSeconds: totalSeconds,
      reps: reps ? parseInt(reps) : undefined,
      sets: sets ? parseInt(sets) : undefined,
      notes: notes.trim() || undefined,
    });
  }

  const lbl = { color: 'var(--hub-label)' };

  return (
    <div className="py-4" style={{ borderBottom: '1px solid var(--hub-border)' }}>
      <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--hub-primary-strong)' }}>
        {typeEmoji[workout.type]} Editar {typeLabel[workout.type]}
      </p>
      <div className="space-y-4">
        {isRunning && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs" style={lbl}>Distância (m)</label>
              <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={lbl}>Min</label>
              <input type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={lbl}>Seg</label>
              <input type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
          </div>
        )}
        {isReps && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs" style={lbl}>Repetições</label>
              <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="mb-1 block text-xs" style={lbl}>Séries</label>
              <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} className={inputClass} style={inputStyle} />
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs" style={lbl}>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="mb-1 block text-xs" style={lbl}>Notas</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div className="flex items-center gap-5 pt-1">
          <button onClick={save} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salvar
          </button>
          <button onClick={onCancel} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
