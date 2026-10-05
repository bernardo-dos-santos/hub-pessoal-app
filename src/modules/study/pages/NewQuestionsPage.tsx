import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import { StudySourcePicker } from '../components/StudySourcePicker';
import { MathText } from '../components/MathText';
import { aiQuestionService } from '../services/aiQuestionService';
import { questionService, type NewQuestion } from '../services/questionService';
import { studySourceService, type StudySource } from '../services/studySourceService';
import {
  type ExamStyle,
  type QuestionDifficulty,
  DIFFICULTY_LABEL,
  EXAM_STYLE_LABEL,
} from '../types/question';

const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
};

/** Gerar questões a partir de material da faculdade ou de um tema de concurso. */
export function NewQuestionsPage() {
  const aiReady = useAiAvailable();
  const [source, setSource] = useState<StudySource | null>(null);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty | 'mixed'>('mixed');
  const [examStyle, setExamStyle] = useState<ExamStyle>('faculdade');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<NewQuestion[] | null>(null);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});

  const canRun = aiReady && studySourceService.hasContent(source) && !loading;
  const bankCount = source ? questionService.listBySubject(source.subjectTag).length : 0;

  async function generate() {
    if (!source) return;
    setLoading(true);
    setError('');
    setGenerated(null);
    setReveal({});
    setStatus('Preparando material…');

    try {
      const sourceText = await studySourceService.buildText(source, setStatus);
      if (!sourceText.trim()) {
        setError('Nenhum conteúdo disponível. Selecione materiais com texto extraído ou cole um texto.');
        return;
      }

      setStatus('Gerando questões…');
      const questions = await aiQuestionService.generateQuestions({
        sourceText,
        subjectTag: source.subjectTag,
        count,
        difficulty,
        examStyle,
      });
      const withMaterials = source.kind === 'college' && source.materialIds.length > 0
        ? questions.map((q) => ({ ...q, materialIds: source.materialIds }))
        : questions;

      // Auto-save imediato — sem botão "Salvar".
      questionService.addMany(withMaterials);
      setGenerated(questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar as questões.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Gerar questões" />

      {!aiReady ? (
        <div style={{ borderLeft: '2px solid var(--hub-warning)', paddingLeft: '12px' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--hub-warning)' }}>IA não configurada</p>
          <Link to="/configuracoes/ia" className="mt-2 inline-block text-xs font-medium" style={{ color: 'var(--hub-warning)' }}>
            Configurar IA →
          </Link>
        </div>
      ) : (
        <Card>
          <div className="space-y-5">
          <StudySourcePicker onChange={setSource} />

          <div className="grid grid-cols-3 gap-5">
            <div>
              <label className="mb-2 block" style={LABEL_STYLE}>Quantidade</label>
              <Select value={String(count)} onChange={(v) => setCount(Number(v))} className="w-full">
                {[5, 10, 20, 30, 50].map((n) => <Select.Option key={n} value={String(n)}>{n}</Select.Option>)}
              </Select>
            </div>
            <div>
              <label className="mb-2 block" style={LABEL_STYLE}>Dificuldade</label>
              <Select value={difficulty} onChange={(v) => setDifficulty(v as QuestionDifficulty | 'mixed')} className="w-full">
                <Select.Option value="mixed">Variada</Select.Option>
                {(Object.keys(DIFFICULTY_LABEL) as QuestionDifficulty[]).map((d) => (
                  <Select.Option key={d} value={d}>{DIFFICULTY_LABEL[d]}</Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-2 block" style={LABEL_STYLE}>Estilo de banca</label>
              <Select value={examStyle} onChange={(v) => setExamStyle(v as ExamStyle)} className="w-full">
                {(Object.keys(EXAM_STYLE_LABEL) as ExamStyle[]).map((s) => (
                  <Select.Option key={s} value={s}>{EXAM_STYLE_LABEL[s]}</Select.Option>
                ))}
              </Select>
            </div>
          </div>

          {bankCount > 0 && !loading && (
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Banco atual: <span style={{ color: 'var(--hub-positive)' }}>{bankCount} questões</span> salvas em {source?.subjectTag}.
            </p>
          )}

          <button
            onClick={generate}
            disabled={!canRun}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {loading ? (status || 'Gerando…') : 'Gerar questões'}
          </button>

          {error && <p className="text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>}

          {generated && (
            <div className="space-y-4" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--hub-positive)' }}>
                  ✓ {generated.length} questões salvas em {source?.subjectTag}
                </p>
                <Link
                  to={`/estudos/questoes/praticar?tag=${encodeURIComponent(source?.subjectTag ?? '')}`}
                  className="text-xs font-medium"
                  style={{ color: 'var(--hub-accent)' }}
                >
                  Praticar agora
                </Link>
              </div>

              {generated.map((q, i) => (
                <div key={i} className="space-y-2 py-3" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                  <MathText content={q.statement} className="text-sm" style={{ color: 'var(--hub-text)' }} />
                  {reveal[i] ? (
                    <div className="space-y-1">
                      {q.options.map((o) => (
                        <p
                          key={o.letter}
                          className="text-xs"
                          style={{ color: o.letter === q.correctOption ? 'var(--hub-positive)' : 'var(--hub-subtle)' }}
                        >
                          <span style={{ fontWeight: 600 }}>{o.letter})</span> <MathText inline content={o.text} />
                        </p>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => setReveal((r) => ({ ...r, [i]: true }))}
                      className="text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      ver alternativas
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </Card>
      )}
    </div>
  );
}
