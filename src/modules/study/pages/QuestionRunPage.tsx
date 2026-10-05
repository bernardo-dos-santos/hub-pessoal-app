import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ModuleHeader } from '../../../shared/ui';
import { deckService } from '../services/deckService';
import { questionService } from '../services/questionService';
import { studySessionService } from '../services/studySessionService';
import { flashcardAutoService } from '../services/flashcardAutoService';
import { retentionService } from '../services/retentionService';
import { isDue } from '../services/spacedRepetitionService';
import { MathText } from '../components/MathText';
import { SessionSummary } from '../components/SessionSummary';
import type { Rating } from '../services/spacedRepetitionService';
import type { Question } from '../types/question';

const DUE_LIMIT = 15;
const NEW_LIMIT = 10;

/**
 * A sessão de questões do módulo.
 *
 * Existiam duas concorrentes: `/estudos/sessao` (SM-2 + prática na matéria mais
 * fraca, limites 10+5, tela de conclusão com minutos) e
 * `/estudos/praticar/questoes` (SM-2 + questões novas embaralhadas, limites
 * 15+10, tela de conclusão com retenção). Eram o mesmo produto com dois
 * conjuntos de números e duas telas de fim.
 *
 * Ficou o motor daqui — ele filtra por `?tag=`, mistura vencidas com novas e cria
 * flashcard automático no erro — somado ao que só a outra tinha: o cronômetro e o
 * `recordActivity('sessao', minutos)`. Sem isso o tempo estudado entrava como
 * zero e o `homepageRanker` subestimava a atividade do dia.
 */
export function QuestionRunPage() {
  const [searchParams] = useSearchParams();
  const filterTag = searchParams.get('tag') ?? undefined;

  const queue = useMemo<Question[]>(() => {
    const states = deckService.listQuestCardStates();
    const statedIds = new Set(states.map((s) => s.questionId));

    const due = states
      .filter((s) => isDue(s.nextReviewAt))
      .map((s) => questionService.getById(s.questionId))
      .filter((q): q is Question => q !== null)
      .filter((q) => !filterTag || q.subjectTag === filterTag)
      .slice(0, DUE_LIMIT);

    const pool = filterTag ? questionService.listBySubject(filterTag) : questionService.listQuestions();
    const fresh = pool.filter((q) => !statedIds.has(q.id)).slice(0, NEW_LIMIT);

    const combined = [...due, ...fresh];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    return combined;
  }, [filterTag]);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [autoFlashcard, setAutoFlashcard] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const recordedRef = useRef(false);

  // Cronômetro roda enquanto a sessão está em andamento.
  useEffect(() => {
    if (done || queue.length === 0) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [done, queue.length]);

  useEffect(() => {
    if (!done || recordedRef.current) return;
    recordedRef.current = true;
    retentionService.record('questoes', correctRef.current, answeredRef.current);
    studySessionService.recordActivity('sessao', Math.max(1, Math.round(elapsed / 60)));
  }, [done, elapsed]);

  if (queue.length === 0) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title="Praticar" />
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>
            {filterTag ? `Nenhuma questão de "${filterTag}" para revisar.` : 'Nenhuma questão para revisar agora.'}
          </p>
          <Link
            to="/estudos/questoes/gerar"
            className="inline-block text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)' }}
          >
            Gerar questões →
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title="Praticar" />
        <SessionSummary
          total={queue.length}
          correct={correctRef.current}
          elapsedSeconds={elapsed}
          itemNoun="questão"
          backTo="/estudos/questoes"
          backLabel="Voltar às questões"
        />
      </div>
    );
  }

  const q = queue[idx];
  const isCorrect = revealed && chosen === q.correctOption;

  function handleAnswer(letter: string) {
    if (revealed) return;
    setChosen(letter);
    setRevealed(true);
    const correct = letter === q.correctOption;
    answeredRef.current++;
    if (correct) correctRef.current++;
    const rating: Rating = correct ? 'good' : 'forgot';
    deckService.advanceQuestCard(q.id, rating, letter);
    if (!correct) setAutoFlashcard(flashcardAutoService.recordWrong(q));
  }

  function next() {
    setChosen(null);
    setRevealed(false);
    setAutoFlashcard(null);
    if (idx + 1 >= queue.length) setDone(true);
    else setIdx((i) => i + 1);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title={filterTag ? `Praticar · ${filterTag}` : 'Praticar'} />

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>
            {idx + 1}/{queue.length}
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round((idx / queue.length) * 100)}%`, background: 'var(--hub-accent)' }}
          />
        </div>

        <div className="py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>
            {q.subjectTag}
          </p>
          <MathText content={q.statement} className="text-sm font-medium leading-relaxed" style={{ color: 'var(--hub-text)' }} />
        </div>

        <div className="space-y-0">
          {q.options.map((opt) => {
            let color: string;
            let borderColor: string;
            if (revealed) {
              if (opt.letter === q.correctOption) {
                color = 'var(--hub-positive)'; borderColor = 'var(--hub-positive)';
              } else if (opt.letter === chosen) {
                color = 'var(--hub-negative)'; borderColor = 'var(--hub-negative)';
              } else {
                color = 'var(--hub-disabled)'; borderColor = 'var(--hub-border)';
              }
            } else if (chosen === opt.letter) {
              color = 'var(--hub-accent)'; borderColor = 'var(--hub-accent)';
            } else {
              color = 'var(--hub-muted)'; borderColor = 'var(--hub-border)';
            }

            return (
              <button
                key={opt.letter}
                onClick={() => handleAnswer(opt.letter)}
                disabled={revealed}
                className="w-full px-3 py-2.5 text-left text-sm transition-opacity hover:opacity-80 disabled:cursor-default"
                style={{ background: 'none', border: 'none', borderBottom: `1px solid ${borderColor}`, color, cursor: revealed ? 'default' : 'pointer' }}
              >
                <span style={{ fontWeight: 600 }}>{opt.letter})</span>{' '}
                <MathText inline content={opt.text} />
              </button>
            );
          })}
        </div>

        {revealed && (
          <div className="space-y-3">
            {q.explanation && (
              <div className="py-3" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 30%, transparent)', paddingLeft: '10px' }}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Explicação</p>
                <MathText content={q.explanation} className="text-xs leading-relaxed" style={{ color: 'var(--hub-muted)' }} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: isCorrect ? 'var(--hub-positive)' : 'var(--hub-negative)' }}>
                {isCorrect ? '✓ Correto' : '✗ Errado'}
              </span>
              <button
                onClick={next}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {idx + 1 < queue.length ? 'Próxima →' : 'Finalizar'}
              </button>
            </div>
            {autoFlashcard && (
              <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
                ✨ Flashcard criado automaticamente em «Auto — {autoFlashcard}»
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
