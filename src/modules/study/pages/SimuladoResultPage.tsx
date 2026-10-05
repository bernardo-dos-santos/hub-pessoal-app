import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ModuleHeader } from '../../../shared/ui';
import { simuladoService } from '../services/simuladoService';
import { questionService } from '../services/questionService';
import { MathText } from '../components/MathText';
import type { SimuladoAnswer } from '../types/simulado';
import type { Question } from '../types/question';
import { ExplainErrorButton } from '../components/ExplainErrorButton';

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}min ${s}s` : `${s}s`;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--hub-positive)';
  if (score >= 50) return 'var(--hub-warning)';
  return 'var(--hub-negative)';
}

export function SimuladoResultPage() {
  const { resultId } = useParams<{ resultId: string }>();

  const result = useMemo(() => simuladoService.getResultById(resultId!), [resultId]);

  // Tags de disciplina (subjectTag) presentes neste simulado — exclui sub-tags do byTag
  const simuladoSubjectTags = useMemo<Set<string>>(() => {
    if (!result) return new Set();
    return new Set(
      result.answers
        .map((a) => questionService.getById(a.questionId)?.subjectTag)
        .filter((t): t is string => Boolean(t)),
    );
  }, [result]);

  const wrongAnswers = useMemo<Array<{ answer: SimuladoAnswer; question: Question }>>(() => {
    if (!result) return [];
    return result.answers
      .filter((a) => a.status !== 'correct')
      .map((a) => ({ answer: a, question: questionService.getById(a.questionId)! }))
      .filter((x) => x.question !== null);
  }, [result]);



  if (!result) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title="Resultado" />
        <div className="py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Resultado não encontrado.</p>
          <Link to="/estudos/simulados" className="mt-4 inline-block text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const correctCount = result.answers.filter((a) => a.status === 'correct').length;

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Resultado" />
      <div className="space-y-6">
      {/* Score principal */}
      <div className="py-6 text-center" style={{ borderBottom: '1px solid var(--hub-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>{result.title}</p>
        <p className="mt-2 text-5xl font-bold tabular-nums" style={{ color: scoreColor(result.score) }}>
          {result.score}%
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--hub-subtle)' }}>
          {correctCount}/{result.answers.length} corretas · {formatTime(result.durationSpentSec)}
        </p>
      </div>

      {/* Análise por matéria */}
      {result.byTag.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
            Por matéria
          </h2>
          {result.byTag
            .filter((t) => simuladoSubjectTags.has(t.tag))
            .sort((a, b) => b.correct / b.total - a.correct / a.total)
            .map((t) => {
              const pct = Math.round((t.correct / t.total) * 100);
              return (
                <div key={t.tag} className="flex items-center gap-3 py-1.5">
                  <span className="w-40 shrink-0 truncate text-xs" style={{ color: 'var(--hub-muted)' }}>{t.tag}</span>
                  <div className="flex-1 overflow-hidden rounded-full h-2" style={{ background: 'var(--hub-border)' }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct >= 70 ? 'var(--hub-positive)' : pct >= 50 ? 'var(--hub-warning)' : 'var(--hub-negative)' }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums" style={{ color: scoreColor(pct) }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Links */}
      <div className="flex gap-4">
        <Link
          to="/estudos/erros"
          className="text-xs font-bold transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-muted)' }}
        >
          Caderno de erros
        </Link>
        <Link
          to="/estudos/simulados"
          className="text-xs font-bold transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)' }}
        >
          Novo simulado
        </Link>
      </div>

      {/* Questões erradas / não sei */}
      {wrongAnswers.length > 0 && (
        <div style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
            Erros e "Não sei" ({wrongAnswers.length})
          </h2>
          {wrongAnswers.map(({ answer, question }) => (
            <div
              key={question.id}
              className="space-y-3 py-4"
              style={{ borderBottom: '1px solid var(--hub-border)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>{question.subjectTag}</p>
              <MathText content={question.statement} className="text-sm" style={{ color: 'var(--hub-text)' }} />

              <div className="space-y-1">
                {question.options.map((o) => (
                  <div
                    key={o.letter}
                    className="text-sm"
                    style={{
                      color: o.letter === question.correctOption
                        ? 'var(--hub-positive)'
                        : o.letter === answer.chosenOption
                        ? 'var(--hub-negative)'
                        : 'var(--hub-subtle)',
                      fontWeight: o.letter === question.correctOption ? 600 : 400,
                      textDecoration: o.letter === answer.chosenOption && o.letter !== question.correctOption ? 'line-through' : 'none',
                      opacity: o.letter === answer.chosenOption && o.letter !== question.correctOption ? 0.7 : 1,
                    }}
                  >
                    {o.letter}) <MathText inline content={o.text} />
                  </div>
                ))}
              </div>

              {answer.status === 'unknown' && (
                <p className="text-xs italic" style={{ color: 'var(--hub-subtle)' }}>Não respondida / "Não sei"</p>
              )}

              <ExplainErrorButton question={question} chosenOption={answer.chosenOption} />
            </div>
          ))}
        </div>
      )}

      {wrongAnswers.length === 0 && (
        <p className="text-sm font-medium text-center" style={{ color: 'var(--hub-positive)' }}>
          🎉 Perfeito! Nenhum erro.
        </p>
      )}
      </div>
    </div>
  );
}
