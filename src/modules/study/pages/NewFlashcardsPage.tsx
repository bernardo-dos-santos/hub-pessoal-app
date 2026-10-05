import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ModuleHeader, Select } from '../../../shared/ui';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import { StudySourcePicker } from '../components/StudySourcePicker';
import { MathText } from '../components/MathText';
import { aiFlashcardService, type RawFlashcard } from '../services/aiFlashcardService';
import { deckService } from '../services/deckService';
import { studySourceService, type StudySource } from '../services/studySourceService';

const LABEL_STYLE = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
};

/** Gerar flashcards. O deck de destino é escolhido pela matéria, ou criado na hora. */
export function NewFlashcardsPage() {
  const aiReady = useAiAvailable();
  const decks = deckService.listDecks();

  const [source, setSource] = useState<StudySource | null>(null);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cards, setCards] = useState<RawFlashcard[] | null>(null);
  const [savedDeck, setSavedDeck] = useState<{ id: string; name: string } | null>(null);

  const canRun = aiReady && studySourceService.hasContent(source) && !loading;

  async function generate() {
    if (!source) return;
    setLoading(true);
    setError('');
    setCards(null);
    setSavedDeck(null);
    setStatus('Preparando material…');

    try {
      const sourceText = await studySourceService.buildText(source, setStatus);
      if (!sourceText.trim()) {
        setError('Nenhum conteúdo disponível. Selecione materiais com texto extraído ou cole um texto.');
        return;
      }

      setStatus('Gerando flashcards…');
      const generated = await aiFlashcardService.generateFlashcards({
        sourceText,
        subjectTag: source.subjectTag,
        count,
      });

      // Auto-save: reaproveita o deck da matéria quando existe, senão cria.
      const match = decks.find((d) => d.subjectTag.toLowerCase() === source.subjectTag.toLowerCase());
      const deck = match ?? deckService.createDeck({ name: source.subjectTag || 'Novo deck', subjectTag: source.subjectTag });
      generated.forEach((c) => deckService.addCard(deck.id, c.front, c.back));

      setCards(generated);
      setSavedDeck({ id: deck.id, name: deck.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar os flashcards.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Gerar flashcards" />

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
            <label className="mb-2 block" style={LABEL_STYLE}>Quantidade</label>
            <Select value={String(count)} onChange={(v) => setCount(Number(v))} className="w-full">
              {[10, 20, 30, 40].map((n) => <Select.Option key={n} value={String(n)}>{n} flashcards</Select.Option>)}
            </Select>
          </div>

          <button
            onClick={generate}
            disabled={!canRun}
            className="text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {loading ? (status || 'Gerando…') : 'Gerar flashcards'}
          </button>

          {error && <p className="text-sm" style={{ color: 'var(--hub-negative)' }}>{error}</p>}

          {cards && savedDeck && (
            <div className="space-y-3" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: 'var(--hub-positive)' }}>
                  ✓ {cards.length} carta(s) salvas em «{savedDeck.name}»
                </p>
                <Link
                  to={`/estudos/flashcards/praticar/${savedDeck.id}`}
                  className="text-xs font-medium"
                  style={{ color: 'var(--hub-accent)' }}
                >
                  Praticar agora
                </Link>
              </div>

              {cards.map((c, i) => (
                <div key={i} className="py-2" style={{ borderBottom: '1px solid var(--hub-border)' }}>
                  <MathText content={c.front} className="text-sm font-medium" style={{ color: 'var(--hub-text)' }} />
                  <MathText content={c.back} className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }} />
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
