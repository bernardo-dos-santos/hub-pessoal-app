import { Link } from 'react-router-dom';

type SessionSummaryProps = {
  /** Quantos itens a sessão percorreu. */
  total: number;
  correct: number;
  /** Duração em segundos. Omitir quando a sessão não cronometra. */
  elapsedSeconds?: number;
  /** "questão" / "carta" — o plural sai daqui com `(s)`, como no resto do app. */
  itemNoun: string;
  backTo: string;
  backLabel: string;
};

/**
 * Tela de conclusão de sessão de estudo.
 *
 * Existiam três, uma por motor de sessão, com emojis diferentes ("✅", "🎉"),
 * conjuntos de métricas diferentes e textos de volta diferentes — a mesma
 * informação apresentada de três jeitos dependendo de onde o usuário entrou.
 */
export function SessionSummary({ total, correct, elapsedSeconds, itemNoun, backTo, backLabel }: SessionSummaryProps) {
  const rate = total > 0 ? Math.round((correct / total) * 100) : null;
  const minutes = elapsedSeconds != null ? Math.max(1, Math.round(elapsedSeconds / 60)) : null;

  return (
    <div className="space-y-4 py-16 text-center">
      <p className="text-lg font-semibold" style={{ color: 'var(--hub-text)' }}>Sessão completa</p>

      <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>
        {total} {itemNoun}(s) revisada(s)
        {minutes !== null && <span className="tabular-nums"> · {minutes} min</span>}
      </p>

      {rate !== null && (
        <p
          className="text-sm tabular-nums"
          style={{ color: rate >= 80 ? 'var(--hub-positive)' : rate >= 60 ? 'var(--hub-warning)' : 'var(--hub-negative)' }}
        >
          Retenção: {rate}%
        </p>
      )}

      <Link
        to={backTo}
        className="inline-block text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--hub-accent)' }}
      >
        {backLabel} →
      </Link>
    </div>
  );
}
