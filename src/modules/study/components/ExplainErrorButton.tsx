import { useState } from 'react';
import { useAiAvailable } from '../../../core/ai/useAiAvailable';
import { aiTutorService } from '../services/aiTutorService';
import { MathText } from './MathText';
import type { Question } from '../types/question';

type ExplainErrorButtonProps = {
  question: Question;
  /** Letra escolhida, ou null quando marcou "não sei". */
  chosenOption: string | null;
};

/**
 * Pede à IA a explicação de um erro e mostra o resultado no lugar do botão.
 *
 * O caderno de erros e o resultado do simulado tinham este mesmo bloco copiado:
 * o par `explanations`/`loadingExplanation`, a mesma chamada a
 * `aiTutorService.explainError` e o mesmo botão "✨ Explicar erro". As duas telas
 * continuam existindo — são contextos diferentes e legítimos —, o que estava
 * duplicado era o código.
 */
export function ExplainErrorButton({ question, chosenOption }: ExplainErrorButtonProps) {
  const aiReady = useAiAvailable();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!aiReady) return null;

  if (explanation) {
    return (
      <div className="py-2" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 30%, transparent)', paddingLeft: '10px' }}>
        <MathText content={explanation} className="text-xs leading-relaxed" style={{ color: 'var(--hub-muted)' }} />
      </div>
    );
  }

  async function explain() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      setExplanation(await aiTutorService.explainError(question, chosenOption));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível explicar agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={explain}
        disabled={loading}
        className="text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
        style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {loading ? 'Explicando…' : '✨ Explicar erro'}
      </button>
      {error && <p className="mt-1 text-xs" style={{ color: 'var(--hub-negative)' }}>{error}</p>}
    </div>
  );
}
