import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ModuleHeader } from '../../../shared/ui';
import { deckService } from '../services/deckService';
import { studySessionService } from '../services/studySessionService';
import { retentionService } from '../services/retentionService';
import { MathText } from '../components/MathText';
import { SessionSummary } from '../components/SessionSummary';
import type { Rating } from '../services/spacedRepetitionService';
import type { Flashcard } from '../types/flashcard';

/** `:deckId` reservado para a sessão que mistura as cartas de todos os decks. */
const MIXED = 'misto';

/**
 * Prática de flashcards, de um deck ou de todos misturados.
 *
 * Eram dois componentes (`FlashcardSession` e `InterleavedSession`) com ~90% de
 * código idêntico — mesma UI de virar carta, mesma barra, mesmos três botões —
 * escolhidos por uma string mágica no `:deckId` (`'interleaved'`). A única
 * diferença real é de onde vem a fila, então isso virou uma condição e não um
 * segundo componente. O modo misto agora se chama `misto` na URL, legível.
 */
export function FlashcardRunPage() {
  const { deckId = '' } = useParams();
  const mixed = deckId === MIXED;

  const decks = useMemo(() => deckService.listDecks(), []);
  const deck = useMemo(() => decks.find((d) => d.id === deckId), [decks, deckId]);
  const deckMap = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks]);

  const initialQueue = useMemo<Flashcard[]>(() => {
    if (mixed) {
      const due = deckService.dueCardsAllDecks();
      return due.length > 0 ? due : deckService.listAllCards();
    }
    const due = deckService.dueCards(deckId);
    return due.length > 0 ? due : deckService.listCards(deckId);
  }, [mixed, deckId]);

  const [queue, setQueue] = useState<Flashcard[]>(initialQueue);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);

  const correctRef = useRef(0);
  const answeredRef = useRef(0);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!done || recordedRef.current) return;
    recordedRef.current = true;
    retentionService.record('flashcard', correctRef.current, answeredRef.current);
    studySessionService.recordActivity('flashcard');
  }, [done]);

  const title = mixed ? 'Sessão mista' : deck?.name ?? 'Flashcards';

  if (!mixed && !deck) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title="Flashcards" />
        <p className="py-16 text-center text-sm" style={{ color: 'var(--hub-subtle)' }}>Deck não encontrado.</p>
      </div>
    );
  }

  if (initialQueue.length === 0) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title={title} />
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>
            {mixed ? 'Nenhuma carta para revisar agora.' : 'Este deck não tem cartas ainda.'}
          </p>
          <Link
            to="/estudos/flashcards"
            className="inline-block text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)' }}
          >
            Voltar aos decks →
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <ModuleHeader eyebrow="Módulo · Estudos" title={title} />
        <SessionSummary
          total={initialQueue.length}
          correct={correctRef.current}
          itemNoun="carta"
          backTo="/estudos/flashcards"
          backLabel="Voltar aos decks"
        />
      </div>
    );
  }

  const card = queue[idx];
  const cardDeckName = mixed ? deckMap.get(card.deckId)?.name : null;
  const remaining = queue.length - idx;

  function rate(rating: Rating) {
    answeredRef.current++;
    if (rating !== 'forgot') correctRef.current++;
    deckService.advanceCard(card.id, rating);
    setFlipped(false);
    // Errou volta pro fim da fila: a carta só sai quando for lembrada.
    if (rating === 'forgot') setQueue((q) => [...q, card]);
    if (idx + 1 >= queue.length && rating !== 'forgot') setDone(true);
    else setIdx((i) => i + 1);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title={title} />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--hub-subtle)' }}>
            {cardDeckName ?? ' '}
          </span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--hub-subtle)' }}>{remaining} restante(s)</span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--hub-border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round((idx / queue.length) * 100)}%`, background: 'var(--hub-accent)' }}
          />
        </div>

        <div
          onClick={() => !flipped && setFlipped(true)}
          className="flex min-h-48 cursor-pointer flex-col items-center justify-center px-6 py-8 text-center"
          style={{
            border: flipped
              ? '1px solid color-mix(in srgb, var(--hub-accent) 30%, transparent)'
              : '1px solid var(--hub-border)',
            borderLeft: flipped ? '2px solid var(--hub-accent)' : '2px solid transparent',
          }}
        >
          {!flipped ? (
            <>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Frente</p>
              <MathText content={card.front} className="text-base font-medium leading-relaxed" style={{ color: 'var(--hub-text)' }} />
              <p className="mt-6 text-xs" style={{ color: 'var(--hub-disabled)' }}>Toque para revelar</p>
            </>
          ) : (
            <>
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-accent)' }}>Verso</p>
              <MathText content={card.front} className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--hub-subtle)' }} />
              <div className="my-2 w-full" style={{ borderTop: '1px solid var(--hub-border)' }} />
              <MathText content={card.back} className="text-base font-medium leading-relaxed" style={{ color: 'var(--hub-text)' }} />
            </>
          )}
        </div>

        {flipped ? (
          <div className="grid grid-cols-3 gap-4">
            {([
              ['forgot', 'Errei', 'var(--hub-negative)'],
              ['good', 'Acertei', 'var(--hub-accent)'],
              ['easy', 'Fácil', 'var(--hub-positive)'],
            ] as [Rating, string, string][]).map(([value, label, color]) => (
              <button
                key={value}
                onClick={() => rate(value)}
                className="py-3 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${color}`, color, cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs" style={{ color: 'var(--hub-disabled)' }}>
            Leia a frente e tente lembrar o verso antes de revelar.
          </p>
        )}
      </div>
    </div>
  );
}
