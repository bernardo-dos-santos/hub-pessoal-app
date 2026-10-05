import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { questionService } from '../services/questionService';
import { simuladoService } from '../services/simuladoService';
import { errorNotebookService } from '../services/errorNotebookService';
import { aiHintService } from '../services/aiHintService';
import { studySessionService } from '../services/studySessionService';
import { MathText } from '../components/MathText';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import type { Question } from '../types/question';
import type { SimuladoAnswer } from '../types/simulado';

type RunAnswer = {
  chosenOption: string | null;
  usedHint: boolean;
  done: boolean;
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function SimuladoRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const aiReady = useAiAvailable();

  const simulado = useMemo(() => simuladoService.getById(id!), [id]);
  const questions = useMemo<Question[]>(() => {
    if (!simulado) return [];
    return simulado.questionIds
      .map((qid) => questionService.getById(qid))
      .filter((q): q is Question => q !== null);
  }, [simulado]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, RunAnswer>>({});
  const [elapsed, setElapsed] = useState(0);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hintLoading, setHintLoading] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (finished || questions.length === 0) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [finished, questions.length]);

  if (!simulado || questions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Simulado não encontrado ou sem questões.</p>
        <Link to="/estudos/simulados" className="mt-4 inline-block text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
          Voltar
        </Link>
      </div>
    );
  }

  const question = questions[currentIdx];
  const answer = answers[question.id];
  const isLast = currentIdx === questions.length - 1;
  const doneCount = Object.values(answers).filter((a) => a.done).length;

  function selectOption(letter: string) {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        chosenOption: letter,
        usedHint: prev[question.id]?.usedHint ?? false,
        done: true,
      },
    }));
    if (!isLast) setTimeout(() => setCurrentIdx((i) => i + 1), 300);
  }

  function markUnknown() {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        chosenOption: null,
        usedHint: prev[question.id]?.usedHint ?? false,
        done: true,
      },
    }));
    if (!isLast) setCurrentIdx((i) => i + 1);
  }

  async function loadHint() {
    if (hints[question.id] || hintLoading) return;
    setHintLoading(question.id);
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        chosenOption: prev[question.id]?.chosenOption ?? null,
        usedHint: true,
        done: prev[question.id]?.done ?? false,
      },
    }));
    try {
      const hint = await aiHintService.getHint(question);
      setHints((prev) => ({ ...prev, [question.id]: hint }));
    } finally {
      setHintLoading(null);
    }
  }

  function buildAndFinish() {
    setFinished(true);

    const finalAnswers: SimuladoAnswer[] = questions.map((q) => {
      const a = answers[q.id];
      const chosenOption = a?.chosenOption ?? null;
      let status: SimuladoAnswer['status'];
      if (!a || !a.done) {
        status = 'unknown';
      } else if (chosenOption === null) {
        status = 'unknown';
      } else if (chosenOption === q.correctOption) {
        status = 'correct';
      } else {
        status = 'wrong';
      }
      return { questionId: q.id, chosenOption, status, usedHint: a?.usedHint ?? false };
    });

    const correctCount = finalAnswers.filter((a) => a.status === 'correct').length;
    const score = Math.round((correctCount / questions.length) * 100);

    const tagMap = new Map<string, { correct: number; total: number }>();
    for (const ans of finalAnswers) {
      const q = questions.find((q) => q.id === ans.questionId)!;
      const isCorrect = ans.status === 'correct';

      // Disciplina (subjectTag)
      const subjectEntry = tagMap.get(q.subjectTag) ?? { correct: 0, total: 0 };
      subjectEntry.total++;
      if (isCorrect) subjectEntry.correct++;
      tagMap.set(q.subjectTag, subjectEntry);

      // Sub-tópicos da questão
      for (const subTag of q.tags) {
        const subEntry = tagMap.get(subTag) ?? { correct: 0, total: 0 };
        subEntry.total++;
        if (isCorrect) subEntry.correct++;
        tagMap.set(subTag, subEntry);
      }
    }
    const byTag = Array.from(tagMap.entries()).map(([tag, s]) => ({ tag, ...s }));

    const result = simuladoService.saveResult({
      simuladoId: simulado!.id,
      title: simulado!.title,
      answers: finalAnswers,
      score,
      durationSpentSec: elapsed,
      byTag,
    });
    errorNotebookService.addFromResult(result);
    studySessionService.recordActivity('simulado', Math.round(elapsed / 60));
    navigate(`/estudos/simulados/resultado/${result.id}`, { replace: true });
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho: tempo + progresso */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm" style={{ color: 'var(--hub-muted)' }}>{formatTime(elapsed)}</span>
        <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {doneCount}/{questions.length} respondidas
        </span>
        <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {currentIdx + 1}/{questions.length}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%`, background: 'var(--hub-accent)' }}
        />
      </div>

      {/* Enunciado */}
      <div className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--hub-accent)' }}>
          {question.subjectTag}
        </p>
        <MathText content={question.statement} className="text-sm leading-relaxed" style={{ color: 'var(--hub-text)' }} />
      </div>

      {/* Alternativas */}
      <div className="space-y-0">
        {question.options.map((o) => {
          const isSelected = answer?.chosenOption === o.letter;
          return (
            <button
              key={o.letter}
              onClick={() => selectOption(o.letter)}
              className="w-full px-3 py-2.5 text-left text-sm transition-opacity hover:opacity-80"
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `1px solid ${isSelected ? 'var(--hub-accent)' : 'var(--hub-border)'}`,
                color: isSelected ? 'var(--hub-accent)' : 'var(--hub-muted)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600 }}>{o.letter})</span>{' '}
              <MathText inline content={o.text} />
            </button>
          );
        })}
      </div>

      {/* Dica exibida */}
      {hints[question.id] && (
        <div className="px-3 py-2.5 text-sm" style={{ borderLeft: '2px solid var(--hub-warning)', paddingLeft: '12px' }}>
          💡 <MathText inline content={hints[question.id]} style={{ color: 'var(--hub-warning)' }} />
        </div>
      )}

      {/* Ações: Dica + Não sei */}
      <div className="flex gap-4">
        {aiReady && (
          <button
            onClick={loadHint}
            disabled={!!hintLoading || !!hints[question.id]}
            className="text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{ color: 'var(--hub-warning)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {hintLoading === question.id ? 'Buscando…' : hints[question.id] ? '💡 Dica exibida' : '💡 Dica'}
          </button>
        )}
        <button
          onClick={markUnknown}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Não sei
        </button>
      </div>

      {/* Navegação */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="px-4 py-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-30"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ←
        </button>
        {isLast ? (
          <button
            onClick={buildAndFinish}
            className="flex-1 py-2 text-sm font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Finalizar simulado
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="flex-1 py-2 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Próxima →
          </button>
        )}
      </div>

      {/* Mini-mapa de questões */}
      <div className="flex flex-wrap justify-center gap-1">
        {questions.map((q, i) => {
          const a = answers[q.id];
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              title={`Questão ${i + 1}`}
              className="h-6 w-6 rounded text-[10px] font-bold transition-opacity hover:opacity-70"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: i === currentIdx
                  ? 'var(--hub-accent)'
                  : a?.done
                  ? 'var(--hub-muted)'
                  : 'var(--hub-disabled)',
                borderBottom: `1px solid ${i === currentIdx ? 'var(--hub-accent)' : 'var(--hub-border-strong)'}`,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Botão de finalizar antecipado */}
      {!isLast && (
        <button
          onClick={buildAndFinish}
          className="w-full py-2.5 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Entregar agora ({doneCount}/{questions.length})
        </button>
      )}
    </div>
  );
}
