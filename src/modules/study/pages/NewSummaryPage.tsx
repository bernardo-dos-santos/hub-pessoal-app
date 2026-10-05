import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import { StudySourcePicker } from '../components/StudySourcePicker';
import { MarkdownView } from '../components/MarkdownView';
import { aiSummaryService, type SummaryFormat } from '../services/aiSummaryService';
import { studyContentService } from '../services/studyContentService';
import { studySourceService, type StudySource } from '../services/studySourceService';
import { summaryCacheService } from '../services/summaryCacheService';

const FORMAT_LABEL: Record<SummaryFormat, string> = {
  prova: 'foco em prova',
  resumo: 'resumo corrido',
  topicos: 'tópicos',
};

/**
 * Gerar resumo — o primeiro passo do fluxo da faculdade: material do SIGAA vira
 * texto de estudo.
 *
 * Era o `mode === 'summary'` da GeneratePage, no quarto nível de aba. Virou tela
 * própria porque o destino é outro (biblioteca de resumos, não banco de questões)
 * e as opções são outras.
 */
export function NewSummaryPage() {
  const aiReady = useAiAvailable();
  const [source, setSource] = useState<StudySource | null>(null);
  const [format, setFormat] = useState<SummaryFormat>('prova');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const canRun = aiReady && studySourceService.hasContent(source) && !loading;

  async function generate(force = false) {
    if (!source) return;
    setLoading(true);
    setError('');
    setSummary(null);
    if (!force) setSavedId(null);
    setStatus('Preparando material…');

    try {
      const cacheId = source.kind === 'college'
        ? summaryCacheService.makeId(source.subjectTag, format, source.materialIds)
        : null;

      // Só reaproveita o cache quando a entrada é exatamente a mesma: texto
      // complementar digitado muda o conteúdo sem mudar a chave do cache.
      if (cacheId && !force && source.kind === 'college' && source.extraText.trim() === '') {
        const cached = summaryCacheService.read(cacheId);
        if (cached) {
          setSummary(cached.text);
          setLoading(false);
          setStatus('');
          return;
        }
      }

      const sourceText = await studySourceService.buildText(source, setStatus);
      if (!sourceText.trim()) {
        setError('Nenhum conteúdo disponível. Selecione materiais com texto extraído ou cole um texto.');
        return;
      }

      setStatus('Gerando resumo…');
      const text = await aiSummaryService.summarize({ sourceText, format, subjectTag: source.subjectTag });
      setSummary(text);
      if (cacheId) summaryCacheService.write(cacheId, text);

      // Auto-save, mesmo tratamento de questões e flashcards: sair da tela nunca
      // pode jogar fora o texto e o custo de IA já gasto.
      const title = `${source.subjectTag || 'Resumo'} · ${FORMAT_LABEL[format]}`;
      const existing = force && savedId ? studyContentService.getById(savedId) : null;
      const saved = existing
        ? studyContentService.update(existing.id, { title, subjectTag: source.subjectTag, summary: text })
        : studyContentService.create({ title, subjectTag: source.subjectTag, summary: text });
      setSavedId(saved?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar o resumo.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Novo resumo" />

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

          <div>
            <label
              className="mb-2 block"
              style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--hub-subtle)' }}
            >
              Formato
            </label>
            <Select value={format} onChange={(v) => setFormat(v as SummaryFormat)} className="w-full">
              <Select.Option value="prova">Foco em prova (o que mais cai)</Select.Option>
              <Select.Option value="resumo">Resumo corrido</Select.Option>
              <Select.Option value="topicos">Tópicos e marcadores</Select.Option>
            </Select>
          </div>

          <button
            onClick={() => generate(false)}
            disabled={!canRun}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {loading ? (status || 'Gerando…') : 'Gerar resumo'}
          </button>

          {error && <p className="text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>}

          {summary && (
            <div className="space-y-3" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
              <div className="flex items-center justify-between">
                <p
                  className="font-medium uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}
                >
                  Resumo salvo
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => generate(true)}
                    disabled={loading}
                    className="text-xs transition-opacity hover:opacity-70 disabled:opacity-30"
                    style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ↺ Regenerar
                  </button>
                  {savedId && (
                    <Link to={`/estudos/resumos/${savedId}`} className="text-xs font-medium" style={{ color: 'var(--hub-positive)' }}>
                      Abrir no leitor
                    </Link>
                  )}
                </div>
              </div>
              <MarkdownView content={summary} />
            </div>
          )}
          </div>
        </Card>
      )}
    </div>
  );
}
