import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { concursoService } from '../../core/concurso/concursoService';
import { TafStatusCard } from '../../modules/fitness/components/TafStatusCard';
import { tafService } from '../../modules/fitness/services/tafService';
import { BackButton } from '../../shared/ui';

type EditalAlert = {
  title: string;
  url: string;
  foundKeyword: string;
  detectedAt: string;
};

type EditalData = {
  checkedAt: string | null;
  alerts: EditalAlert[];
};

function getPhase(days: number): { label: string; description: string; color: string } {
  if (days > 90) return { label: 'Fase Base', description: 'Foco em volume e regularidade — construir a base aeróbica e de força.', color: 'var(--hub-positive)' };
  if (days > 30) return { label: 'Fase Específica', description: 'Treinos direcionados ao TAF — séries, repetições e Cooper com intensidade.', color: 'var(--hub-warning)' };
  if (days > 0)  return { label: 'Fase de Pico', description: 'Manutenção da forma e descanso — evitar lesões e chegar descansado.', color: 'var(--hub-negative)' };
  return { label: 'Prova chegou!', description: 'Boa sorte, Bombeiro.', color: 'var(--hub-accent)' };
}

function countdownColor(days: number): string {
  if (days > 90) return 'var(--hub-positive)';
  if (days > 30) return 'var(--hub-warning)';
  if (days > 0)  return 'var(--hub-negative)';
  return 'var(--hub-accent)';
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatCheckedAt(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function ConcursoCbscPage() {
  const [examDate, setExamDate] = useState<string | null>(concursoService.getExamDate);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(examDate ?? '');
  const [edital, setEdital] = useState<EditalData | null>(null);

  const days = concursoService.getDaysUntilExam();
  const tafResults = tafService.getAllTestResults();
  const phase = days !== null ? getPhase(days) : null;

  useEffect(() => {
    fetch('/edital-alerts.json')
      .then((r) => r.json())
      .then((data: EditalData) => setEdital(data))
      .catch(() => setEdital({ checkedAt: null, alerts: [] }));
  }, []);

  function saveDate() {
    if (!dateInput) return;
    concursoService.setExamDate(dateInput);
    setExamDate(dateInput);
    setEditingDate(false);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-6">
      {/* Header */}
      <BackButton />
      <div className="flex items-center gap-3">
        <span className="text-3xl">🚒</span>
        <div>
          <h1 className="text-2xl font-medium" style={{ color: 'var(--hub-text)' }}>Concurso CBSC</h1>
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Corpo de Bombeiros de Santa Catarina</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="text-center" style={{ borderBottom: '1px solid var(--hub-border)', paddingBottom: '32px' }}>
        {days !== null && examDate ? (
          <>
            <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>TAF em</p>
            <p className="mt-2 tabular-nums" style={{ fontSize: '64px', fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1, color: countdownColor(days) }}>
              {days > 0 ? days : '🎯'}
            </p>
            <p className="mt-2 text-lg" style={{ color: countdownColor(days) }}>
              {days > 0 ? `dia${days !== 1 ? 's' : ''}` : 'Hoje é o dia!'}
            </p>
            <p className="mt-3 text-sm" style={{ color: 'var(--hub-subtle)' }}>
              Prova prevista:{' '}
              <span className="font-medium" style={{ color: 'var(--hub-text)' }}>{formatDate(examDate)}</span>
            </p>
            <button
              onClick={() => { setDateInput(examDate); setEditingDate(true); }}
              className="mt-2 text-xs underline transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              alterar data
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p style={{ color: 'var(--hub-muted)' }}>Defina a data prevista da prova para ver o countdown.</p>
            {editingDate || !examDate ? (
              <div className="flex items-baseline justify-center gap-4">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-40 text-sm"
                />
                <button
                  onClick={saveDate}
                  disabled={!dateInput}
                  className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                  style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Salvar
                </button>
              </div>
            ) : null}
          </div>
        )}

        {editingDate && examDate && (
          <div className="mt-4 flex items-baseline justify-center gap-4">
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-40 text-sm"
            />
            <button
              onClick={saveDate}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Salvar
            </button>
            <button
              onClick={() => setEditingDate(false)}
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Fase atual */}
      {phase && (
        <div>
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: phase.color }}>
            {phase.label}
          </span>
          <p className="mt-1 text-sm" style={{ color: 'var(--hub-muted)' }}>{phase.description}</p>
        </div>
      )}

      {/* Status TAF */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
            Status TAF
          </h2>
          <Link to="/treino/taf" className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
            Ver detalhes →
          </Link>
        </div>
        <div className="grid gap-x-10 sm:grid-cols-2">
          {tafResults.map((result) => (
            <TafStatusCard key={result.requirement.id} result={result} />
          ))}
        </div>
      </section>

      {/* Edital */}
      <section>
        <h2 className="mb-3 font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
          Monitor de Edital
        </h2>
        {edital === null ? (
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Carregando…</p>
        ) : edital.alerts.length > 0 ? (
          <div>
            {edital.alerts.map((alert, i) => (
              <div key={i} className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--hub-negative)' }}>{alert.title}</p>
                <p className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
                  Palavra-chave: {alert.foundKeyword} · {formatCheckedAt(alert.detectedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--hub-muted)' }}>
            {edital.checkedAt
              ? `Nenhuma novidade. Verificado em ${formatCheckedAt(edital.checkedAt)}.`
              : 'Monitor ainda não configurado. Rode o script de edital para ativar.'}
          </p>
        )}
      </section>

      {/* CTA */}
      <Link
        to="/treino/registrar"
        className="inline-block text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-positive)' }}
      >
        🏃 Registrar treino de hoje →
      </Link>
    </div>
  );
}
