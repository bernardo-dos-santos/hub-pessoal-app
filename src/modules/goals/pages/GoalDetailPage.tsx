import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { goalService } from '../services/goalService';
import { type GoalCategory } from '../types/goal';
import { Card, ProgressBar, BackButton, Eyebrow, Button } from '../../../shared/ui';

const CATEGORY_LABEL: Record<GoalCategory, string> = {
  concurso: 'Concurso', financeiro: 'Financeiro', saude: 'Saúde',
  pessoal: 'Pessoal', faculdade: 'Faculdade',
};

const CATEGORY_COLOR: Record<GoalCategory, string> = {
  concurso:   'var(--hub-negative)',
  financeiro: 'var(--hub-positive)',
  saude:      'var(--hub-accent)',
  pessoal:    'var(--hub-mauve)',
  faculdade:  'var(--hub-warning)',
};

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(() => (id ? goalService.getById(id) : null));

  const g = goal;
  const progress = goal ? goalService.getProgress(goal) : 0;

  function toggleKR(krId: string) {
    if (!g) return;
    const updated = goalService.toggleKeyResult(g.id, krId);
    if (updated) setGoal(updated);
  }

  function handleDelete() {
    if (!g) return;
    if (!confirm('Excluir esta meta?')) return;
    goalService.delete(g.id);
    navigate('/metas');
  }

  function handleComplete() {
    if (!g) return;
    const updated = goalService.update(g.id, { status: 'completed' });
    if (updated) setGoal(updated);
  }

  function handleAbandon() {
    if (!g) return;
    if (!confirm('Marcar como abandonada?')) return;
    const updated = goalService.update(g.id, { status: 'abandoned' });
    if (updated) setGoal(updated);
  }

  if (!goal) {
    return (
      <Card className="text-center">
        <p style={{ color: 'var(--hub-muted)' }}>
          Meta não encontrada.{' '}
          <button
            onClick={() => navigate('/metas')}
            className="underline transition-opacity hover:opacity-70"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hub-primary)' }}
          >
            Voltar
          </button>
        </p>
      </Card>
    );
  }

  const catColor = CATEGORY_COLOR[goal.category];

  return (
    <div className="space-y-5">
      <div className="mb-1"><BackButton /></div>

      {/* Header + progresso */}
      <Card hero>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
            <span className="text-[10px] font-medium" style={{ color: catColor }}>
              {CATEGORY_LABEL[goal.category]}
            </span>
          </div>
          {goal.status !== 'active' && (
            <span className="text-[10px] font-medium" style={{
              color: goal.status === 'completed' ? 'var(--hub-positive)' : 'var(--hub-muted)',
            }}>
              {goal.status === 'completed' ? '✓ Concluída' : 'Abandonada'}
            </span>
          )}
        </div>
        <h1 className="mt-1 text-xl font-medium" style={{ color: 'var(--hub-text)' }}>{goal.title}</h1>
        {goal.description && (
          <p className="mt-1 text-sm" style={{ color: 'var(--hub-muted)' }}>{goal.description}</p>
        )}
        {goal.targetDate && (
          <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
            Prazo: {new Date(goal.targetDate).toLocaleDateString('pt-BR')}
          </p>
        )}

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium" style={{ color: 'var(--hub-muted)' }}>Progresso</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: progress === 100 ? 'var(--hub-positive)' : 'var(--hub-primary)' }}>
              {progress}%
            </p>
          </div>
          <ProgressBar value={progress} percent signal={progress === 100 ? 'positive' : 'accent'} />
          <p className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
            {goal.keyResults.filter((kr) => kr.status === 'done').length}/{goal.keyResults.length} key results concluídos
          </p>
        </div>
      </Card>

      {/* Key Results */}
      {goal.keyResults.length > 0 && (
        <Card>
          <Eyebrow style={{ marginBottom: '10px' }}>Key results</Eyebrow>
          {goal.keyResults.map((kr, i) => (
            <button
              key={kr.id}
              onClick={() => toggleKR(kr.id)}
              className="flex w-full items-center gap-3 text-left transition-opacity hover:opacity-80"
              style={{
                padding: '12px 0',
                borderBottom: i === goal.keyResults.length - 1 ? 'none' : '1px solid var(--hub-border)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span
                className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] transition"
                style={{
                  background: kr.status === 'done' ? 'color-mix(in srgb, var(--hub-positive) 20%, transparent)' : 'transparent',
                  color: kr.status === 'done' ? 'var(--hub-positive)' : 'transparent',
                  border: `1px solid ${kr.status === 'done' ? 'var(--hub-positive)' : 'var(--hub-border-strong)'}`,
                }}
              >
                ✓
              </span>
              <div className="min-w-0">
                <p
                  className="text-sm"
                  style={{
                    color: kr.status === 'done' ? 'var(--hub-subtle)' : 'var(--hub-text)',
                    textDecoration: kr.status === 'done' ? 'line-through' : 'none',
                  }}
                >
                  {kr.title}
                </p>
                {kr.target && (
                  <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>{kr.target}</p>
                )}
              </div>
            </button>
          ))}
        </Card>
      )}

      {/* Ações */}
      {goal.status === 'active' && (
        <div className="flex items-center gap-6 px-1">
          <Button variant="text" onClick={handleComplete} style={{ color: 'var(--hub-positive)' }}>
            ✓ Concluir meta
          </Button>
          <Button variant="secondary" onClick={handleAbandon}>Abandonar</Button>
          <Button variant="danger" onClick={handleDelete}>Excluir</Button>
        </div>
      )}
    </div>
  );
}
