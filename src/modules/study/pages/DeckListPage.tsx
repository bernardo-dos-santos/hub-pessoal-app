import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ModuleHeader, Select } from '../../../shared/ui';
import { deckService } from '../services/deckService';
import { questionService } from '../services/questionService';
import { subjectService } from '../../college/services/subjectService';
import { studyProgressService } from '../services/studyProgressService';
import { isDue } from '../services/spacedRepetitionService';
import { CBMSC_SUBJECTS } from '../data/cbmscSubjects';
import { ABIN_SUBJECTS } from '../data/abinSubjects';
import type { Deck, Flashcard } from '../types/flashcard';
import { getStudyTabs } from '../components/studyTabs';
import { errorNotebookService } from '../services/errorNotebookService';

const inputClass = 'w-full';
const selectClass = 'w-full cursor-pointer appearance-none';

function DeckItem({ deck, onDeleted }: { deck: Deck; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [cards, setCards] = useState<Flashcard[]>(() => deckService.listCards(deck.id));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const due = cards.filter((c) => isDue(c.nextReviewAt)).length;

  function handleAddCard() {
    if (!front.trim() || !back.trim()) return;
    deckService.addCard(deck.id, front, back);
    setCards(deckService.listCards(deck.id));
    setFront('');
    setBack('');
  }

  function handleDeleteCard(id: string) {
    deckService.deleteCard(id);
    setCards(deckService.listCards(deck.id));
  }

  function handleDeleteDeck() {
    deckService.deleteDeck(deck.id);
    onDeleted();
  }

  return (
    <div style={{ borderBottom: '1px solid var(--hub-border)' }}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <p className="truncate text-sm font-medium" style={{ color: 'var(--hub-text)' }}>{deck.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            {deck.subjectTag && (
              <span className="text-[10px] font-medium" style={{ color: 'var(--hub-accent)' }}>
                {deck.subjectTag}
              </span>
            )}
            <span className="text-[11px]" style={{ color: 'var(--hub-subtle)' }}>
              {cards.length} carta(s)
              {due > 0 && (
                <span style={{ color: 'var(--hub-warning)' }}> · {due} para revisar</span>
              )}
            </span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          {cards.length > 0 && (
            <Link
              to={`/estudos/flashcards/praticar/${deck.id}`}
              className="text-xs font-bold transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)' }}
            >
              Praticar
            </Link>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleDeleteDeck}
                className="text-xs font-bold transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-negative)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Não
              </button>
            </div>
          )}
          <span className="text-xs select-none" style={{ color: 'var(--hub-subtle)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="pb-4 space-y-3" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '12px' }}>
          {/* Lista de cartas */}
          {cards.length > 0 ? (
            <div className="space-y-0">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-start justify-between gap-2 py-2"
                  style={{ borderBottom: '1px solid var(--hub-border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--hub-text)' }}>{card.front}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--hub-subtle)' }}>{card.back}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="shrink-0 text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--hub-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--hub-subtle)' }}>Nenhuma carta ainda. Adicione abaixo.</p>
          )}

          {/* Formulário nova carta */}
          <div className="space-y-3" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '12px' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Nova carta</p>
            <textarea
              rows={2}
              placeholder="Frente (conceito, pergunta…)"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className={`${inputClass} resize-none text-xs`}
            />
            <textarea
              rows={2}
              placeholder="Verso (definição, resposta…)"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className={`${inputClass} resize-none text-xs`}
            />
            <button
              onClick={handleAddCard}
              disabled={!front.trim() || !back.trim()}
              className="text-xs font-bold transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Adicionar carta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeckListPage() {
  const [decks, setDecks] = useState<Deck[]>(() => deckService.listDecks());
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [deckTag, setDeckTag] = useState('');
  const collegeSubjects = subjectService.listActiveSubjects();

  const totalQuestions = questionService.count();
  const statedCount = deckService.listQuestCardStates().length;
  const dueQuestCount = deckService.dueQuestionsCount();
  const newQuestCount = Math.min(totalQuestions - statedCount, 10);
  const questSessionSize = dueQuestCount + Math.max(0, newQuestCount);
  const weakestTag = decks.length > 0 ? studyProgressService.getWeakestTag() : null;
  const totalDueCards = deckService.listAllCards().filter((c) => isDue(c.nextReviewAt)).length;
  const pendingErrors = errorNotebookService.countPending();

  function handleCreateDeck() {
    if (!deckName.trim()) return;
    deckService.createDeck({ name: deckName.trim(), subjectTag: deckTag.trim() });
    setDecks(deckService.listDecks());
    setDeckName('');
    setDeckTag('');
    setShowNewDeck(false);
  }

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Estudos" title="Flashcards" tabs={getStudyTabs(pendingErrors)} />
      <div className="mb-4 flex justify-end">
        <Link to="/estudos/flashcards/gerar" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
          Gerar flashcards
        </Link>
      </div>
      <div className="space-y-6">
      {/* Questões SM-2 */}
      <div className="py-3" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 40%, transparent)', paddingLeft: '12px' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Questões para revisar</p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              {totalQuestions === 0
                ? 'Gere questões em Gerar para começar.'
                : questSessionSize === 0
                ? 'Nada para revisar hoje. Volte amanhã.'
                : `${dueQuestCount} vencida(s) · ${Math.max(0, newQuestCount)} nova(s) — ${questSessionSize} total`}
            </p>
          </div>
          {questSessionSize > 0 && (
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/estudos/questoes/praticar"
                className="text-xs font-bold transition-opacity hover:opacity-70"
                style={{ color: 'var(--hub-accent)' }}
              >
                Iniciar
              </Link>
              {weakestTag && (
                <Link
                  to={`/estudos/questoes/praticar?tag=${encodeURIComponent(weakestTag)}`}
                  className="text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--hub-subtle)' }}
                  title={`Focar em ${weakestTag}`}
                >
                  mais fraca
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sessão Mista (interleaving) */}
      {totalDueCards > 0 && decks.length > 1 && (
        <div className="py-3" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-positive) 40%, transparent)', paddingLeft: '12px' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--hub-text)' }}>Sessão Mista</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>
                {totalDueCards} carta(s) vencida(s) de {decks.length} decks misturados
              </p>
            </div>
            <Link
              to="/estudos/flashcards/praticar/misto"
              className="shrink-0 text-xs font-bold transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-positive)' }}
            >
              Iniciar
            </Link>
          </div>
        </div>
      )}

      {/* Decks de flashcards */}
      <div className="space-y-4" style={{ borderTop: '1px solid var(--hub-border)', paddingTop: '16px' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--hub-subtle)' }}>Flashcard decks</h2>
          <button
            onClick={() => setShowNewDeck((v) => !v)}
            className="text-xs font-bold transition-opacity hover:opacity-70"
            style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showNewDeck ? 'Cancelar' : '+ Novo deck'}
          </button>
        </div>

        {showNewDeck && (
          <div className="space-y-4" style={{ borderLeft: '2px solid color-mix(in srgb, var(--hub-accent) 30%, transparent)', paddingLeft: '12px' }}>
            <input
              type="text"
              placeholder="Nome do deck (ex: Estruturas de Dados)"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className={inputClass}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
            />
            <Select value={deckTag} onChange={setDeckTag} className={selectClass}>
              <Select.Option value="">Sem matéria</Select.Option>
              {collegeSubjects.length > 0 && (
                <>
                  <Select.Option key="group-college" value="__group_college__" disabled>— Faculdade —</Select.Option>
                  {collegeSubjects.map((s) => (
                    <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
                  ))}
                </>
              )}
              <Select.Option key="group-cbmsc" value="__group_cbmsc__" disabled>— Concurso (CBMSC) —</Select.Option>
              {CBMSC_SUBJECTS.map((s) => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
              <Select.Option key="group-abin" value="__group_abin__" disabled>— Concurso (ABIN) —</Select.Option>
              {ABIN_SUBJECTS.map((s) => (
                <Select.Option key={`abin-${s}`} value={s}>{s}</Select.Option>
              ))}
            </Select>
            <button
              onClick={handleCreateDeck}
              disabled={!deckName.trim()}
              className="text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-30"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Criar deck
            </button>
          </div>
        )}

        {decks.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--hub-subtle)' }}>Nenhum deck criado ainda.</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
              Crie um deck e adicione cartas de frente/verso.
            </p>
          </div>
        ) : (
          <div>
            {decks.map((deck) => (
              <DeckItem
                key={deck.id}
                deck={deck}
                onDeleted={() => setDecks(deckService.listDecks())}
              />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
