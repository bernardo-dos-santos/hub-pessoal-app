import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goalService } from '../services/goalService';
import { type GoalCategory } from '../types/goal';
import { GOAL_CATEGORIES } from '../data/goalCategories';
import { Card, Button, ModuleHeader, DateInput, hub, tint } from '../../../shared/ui';

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-label)',
};

export function CreateGoalPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('pessoal');
  const [targetDate, setTargetDate] = useState('');
  const [keyResults, setKeyResults] = useState<string[]>(['']);

  function addKR() {
    setKeyResults((prev) => [...prev, '']);
  }

  function updateKR(idx: number, value: string) {
    setKeyResults((prev) => prev.map((kr, i) => (i === idx ? value : kr)));
  }

  function removeKR(idx: number) {
    setKeyResults((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!title.trim()) return;
    const krs = keyResults.map((t) => ({ title: t })).filter((kr) => kr.title.trim());
    goalService.create({
      title, description, category,
      targetDate: targetDate || undefined,
      keyResults: krs,
    });
    navigate('/metas');
  }

  const canSave = title.trim().length > 0;

  return (
    <div className="space-y-5">
      <ModuleHeader eyebrow="Módulo · Metas" title="Nova meta" />

      <Card>
        <div className="space-y-6">
          {/* Título */}
          <div>
            <label style={labelStyle}>Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Montar a reserva de emergência" className="w-full" autoFocus />
          </div>

          {/* Descrição */}
          <div>
            <label style={labelStyle}>Descrição (opcional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexto ou motivação desta meta" rows={2} className="w-full leading-6 resize-none" />
          </div>

          {/* Categoria */}
          <div>
            <label style={labelStyle}>Categoria</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {GOAL_CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className="flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors"
                    style={{
                      borderRadius: 'var(--hub-radius-card)',
                      cursor: 'pointer',
                      background: active ? tint(hub.accent, 12) : 'transparent',
                      color: active ? 'var(--hub-primary-strong)' : 'var(--hub-muted)',
                      border: `1px solid ${active ? tint(hub.accent, 30) : 'var(--hub-border)'}`,
                    }}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prazo */}
          <div>
            <label style={labelStyle}>Prazo (opcional)</label>
            <DateInput className="w-full" value={targetDate} onChange={setTargetDate} ariaLabel="Prazo da meta" placeholder="Sem prazo" />
          </div>

          {/* Key Results */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label style={labelStyle}>Key results (etapas mensuráveis)</label>
              <button onClick={addKR} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                + Adicionar
              </button>
            </div>
            <div className="space-y-3">
              {keyResults.map((kr, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{idx + 1}.</span>
                  <input type="text" value={kr} onChange={(e) => updateKR(idx, e.target.value)} placeholder="Ex: Guardar R$ 500 por mês" className="w-full" />
                  {keyResults.length > 1 && (
                    <button onClick={() => removeKR(idx)} className="shrink-0 text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button variant="primary" onClick={handleSave} disabled={!canSave} className="w-full">
            Criar meta
          </Button>
        </div>
      </Card>
    </div>
  );
}
