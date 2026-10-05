import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModuleHeader } from '../../../shared/ui';
import { errorNotebookService } from '../services/errorNotebookService';
import { questionService } from '../services/questionService';
import { aiErrorDrillService, type DrillQuestion, type DrillEvaluation } from '../services/aiErrorDrillService';
import { MathText } from '../components/MathText';
import { type ErrorNotebookEntry } from '../types/errorNotebook';
import { type Question } from '../types/question';

const inputClass = 'w-full resize-none';

type DrillState =
  | { phase: 'select' }
  | { phase: 'loading' }
  | { phase: 'answering'; entry: ErrorNotebookEntry; question: Question; drills: DrillQuestion[]; current: number; userAnswer: string }
  | { phase: 'evaluating' }
  | { phase: 'result'; eval: DrillEvaluation; entry: ErrorNotebookEntry; drillQuestion: DrillQuestion; drills: DrillQuestion[]; current: number; question: Question }
  | { phase: 'done'; mastered: number; total: number };

export function ErrorDrillPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<DrillState>({ phase: 'select' });
  const [masteredCount, setMasteredCount] = useState(0);
  const [drillCount, setDrillCount] = useState(0);
  const [error, setError] = useState('');

  const pending = errorNotebookService.listPending()
    .sort((a, b) => b.timesFailed - a.timesFailed)
    .slice(0, 10);

  async function startDrill(entry: ErrorNotebookEntry) {
    const question = questionService.getById(entry.questionId);
    if (!question) return;
    setState({ phase: 'loading' });
    setError('');
    try {
      const drills = await aiErrorDrillService.generateDrillQuestions(entry, question);
      if (drills.length === 0) throw new Error('Sem questões geradas');
      setState({ phase: 'answering', entry, question, drills, current: 0, userAnswer: '' });
    } catch (err) {
      // alert() nativo era a única caixa do sistema sobrando no módulo: ignora
      // todo token, trava a página e no APK aparece como diálogo do Android.
      // Erro agora é estado da tela, e diz o motivo em vez de sempre culpar a chave.
      setState({ phase: 'select' });
      setError(err instanceof Error ? err.message : 'Falha ao gerar perguntas de revisão.');
    }
  }

  async function submitAnswer() {
    if (state.phase !== 'answering' || !state.userAnswer.trim()) return;
    setState({ phase: 'evaluating' });

    const drillQuestion = state.drills[state.current];
    const evaluation = await aiErrorDrillService.evaluateAnswer(drillQuestion, state.userAnswer);

    setState({
      phase: 'result',
      eval: evaluation,
      entry: state.entry,
      question: state.question,
      drillQuestion,
      drills: state.drills,
      current: state.current,
    });
  }

  function nextQuestion() {
    if (state.phase !== 'result') return;
    const nextIdx = state.current + 1;

    if (state.eval.shouldMarkMastered) {
      errorNotebookService.markMastered(state.entry.id);
      setMasteredCount((n) => n + 1);
    }

    if (nextIdx >= state.drills.length) {
      setDrillCount((n) => n + 1);
      setState({ phase: 'done', mastered: masteredCount + (state.eval.shouldMarkMastered ? 1 : 0), total: drillCount + 1 });
      return;
    }

    setState({
      phase: 'answering',
      entry: state.entry,
      question: state.question,
      drills: state.drills,
      current: nextIdx,
      userAnswer: '',
    });
  }

  // ── Select ─────────────────────────────────────────────────────────────────
  if (state.phase === 'select') {
    return (
      <div>
        {/* Header hand-rolled (h1 + seta ←) trocado pelo ModuleHeader: a seta de
            voltar já vem dele e leva ao lugar certo mesmo em acesso direto. */}
        <ModuleHeader eyebrow="Módulo · Estudos" title="Drill Mode" />

        {error && (
          <p className="mb-4 text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>
        )}

        {pending.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl">🏆</p>
            <p className="mt-2 font-semibold" style={{ color: 'var(--hub-text)' }}>Nenhum erro pendente!</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--hub-subtle)' }}>Complete simulados para popular o caderno.</p>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs" style={{ color: 'var(--hub-subtle)' }}>Escolha um tópico para revisar (priorizados por maior erro):</p>
            {pending.map((entry) => {
              const question = questionService.getById(entry.questionId);
              if (!question) return null;
              return (
                <button
                  key={entry.id}
                  onClick={() => startDrill(entry)}
                  className="w-full py-3 text-left transition-opacity hover:opacity-80"
                  style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--hub-border)', cursor: 'pointer' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm" style={{ color: 'var(--hub-text)' }}>{question.subjectTag}</p>
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--hub-negative)' }}>
                      {entry.timesFailed}x erro
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'var(--hub-subtle)' }}>{question.statement}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (state.phase === 'loading' || state.phase === 'evaluating') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="animate-pulse text-sm" style={{ color: 'var(--hub-subtle)' }}>
          {state.phase === 'loading' ? 'Gerando perguntas de revisão…' : 'Avaliando resposta…'}
        </p>
      </div>
    );
  }

  // ── Answering ───────────────────────────────────────────────────────────────
  if (state.phase === 'answering') {
    const drill = state.drills[state.current];
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Questão {state.current + 1}/{state.drills.length} · {state.question.subjectTag}
          </p>
          <button
            onClick={() => setState({ phase: 'select' })}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Cancelar
          </button>
        </div>

        <div className="py-4 px-0" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 40%, transparent)', paddingLeft: '12px' }}>
          <MathText content={drill.question} className="text-sm font-medium leading-relaxed" style={{ color: 'var(--hub-text)' }} />
        </div>

        <details style={{ borderBottom: '1px solid var(--hub-border)', paddingBottom: '8px' }}>
          <summary className="cursor-pointer text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--hub-subtle)', listStyle: 'none' }}>💡 Dica</summary>
          <MathText content={drill.hint} className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--hub-subtle)' }} />
        </details>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Sua resposta</label>
          <textarea
            value={state.userAnswer}
            onChange={(e) => setState({ ...state, userAnswer: e.target.value })}
            placeholder="Escreva sua resposta em texto livre…"
            rows={4}
            autoFocus
            className={inputClass}
          />
        </div>

        <button
          onClick={submitAnswer}
          disabled={!state.userAnswer.trim()}
          className="w-full py-3 text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-30"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Verificar resposta
        </button>
      </div>
    );
  }

  // ── Result ──────────────────────────────────────────────────────────────────
  if (state.phase === 'result') {
    const scoreColor = {
      correct:   'var(--hub-positive)',
      partial:   'var(--hub-warning)',
      incorrect: 'var(--hub-negative)',
    }[state.eval.score];

    const scoreLabel = { correct: '✓ Correto', partial: '~ Parcial', incorrect: '✕ Incorreto' }[state.eval.score];

    return (
      <div className="space-y-4">
        <div className="py-4" style={{ borderLeft: `2px solid ${scoreColor}`, paddingLeft: '12px' }}>
          <p className="mb-1 text-sm font-bold" style={{ color: scoreColor }}>{scoreLabel}</p>
          <MathText content={state.eval.feedback} className="text-sm leading-relaxed" style={{ color: 'var(--hub-muted)' }} />
        </div>

        <div className="py-3" style={{ borderLeft: '2px solid var(--hub-border)', paddingLeft: '12px' }}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Resposta esperada</p>
          <MathText content={state.drillQuestion.answer} className="text-sm" style={{ color: 'var(--hub-muted)' }} />
        </div>

        {state.eval.shouldMarkMastered && (
          <p className="text-xs" style={{ color: 'var(--hub-positive)' }}>
            ✓ Tópico marcado como dominado no caderno de erros
          </p>
        )}

        <button
          onClick={nextQuestion}
          className="w-full py-3 text-sm font-bold transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {state.current + 1 < state.drills.length ? 'Próxima pergunta →' : 'Finalizar sessão'}
        </button>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl">🎯</span>
      <p className="text-xl font-bold" style={{ color: 'var(--hub-text)' }}>Sessão concluída!</p>
      <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>
        {state.mastered > 0
          ? `${state.mastered} tópico(s) dominado(s) e removidos do caderno.`
          : 'Continue praticando para dominar os tópicos.'}
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => { setMasteredCount(0); setDrillCount(0); setState({ phase: 'select' }); }}
          className="text-sm font-bold transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Nova sessão
        </button>
        <button
          onClick={() => navigate('/estudos/erros')}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Ver caderno
        </button>
      </div>
    </div>
  );
}
