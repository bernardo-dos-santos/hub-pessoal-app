import { useState } from 'react';
import { Card } from '../../../shared/ui';
import { cardService } from '../services/cardService';
import type { Card as FinanceCard } from '../types/card';
import { parseMoneyText } from '../utils/moneyParsing';

const INPUT_CLASS = 'w-full bg-transparent pb-1.5 text-sm outline-none tabular-nums';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--hub-subtle)',
  display: 'block',
  marginBottom: '6px',
};

type CardDraft = {
  limit: string;
  closingDay: string;
  dueDay: string;
};

function toDraft(card: FinanceCard): CardDraft {
  return {
    limit: card.limit != null ? String(card.limit) : '',
    closingDay: card.closingDay != null ? String(card.closingDay) : '',
    dueDay: card.dueDay != null ? String(card.dueDay) : '',
  };
}

/**
 * "5.000" is five thousand (parseFloat read 5); days go up to 31 — a month
 * without that day closes on its last one. Every refusal says why.
 */
function parseDraft(draft: CardDraft): { limit?: number; closingDay?: number; dueDay?: number } | string {
  const limit = draft.limit.trim() !== '' ? parseMoneyText(draft.limit) : undefined;
  const closingDay = draft.closingDay.trim() !== '' ? Number(draft.closingDay) : undefined;
  const dueDay = draft.dueDay.trim() !== '' ? Number(draft.dueDay) : undefined;
  const isDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31;

  if (limit !== undefined && (limit === null || limit <= 0)) return 'Limite inválido — use um valor como 5.000 ou 5000,00.';
  if (closingDay !== undefined && !isDay(closingDay)) return 'Fechamento precisa ser um dia de 1 a 31.';
  if (dueDay !== undefined && !isDay(dueDay)) return 'Vencimento precisa ser um dia de 1 a 31.';
  return { limit: limit ?? undefined, closingDay, dueDay };
}

function NewCardForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<CardDraft>({ limit: '', closingDay: '', dueDay: '' });
  const [error, setError] = useState('');

  function create() {
    const parsed = parseDraft(draft);
    if (typeof parsed === 'string') return setError(parsed);
    if (parsed.closingDay == null || parsed.dueDay == null) return setError('Informe o fechamento e o vencimento — sem eles não há fatura.');
    cardService.createCard({ name: name.trim() || 'Cartão de crédito', ...parsed });
    onCreated();
  }

  const field = (key: keyof CardDraft, label: string, placeholder: string, inputMode: 'decimal' | 'numeric') => (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        inputMode={inputMode}
        placeholder={placeholder}
        className={INPUT_CLASS}
        value={draft[key]}
        onChange={(e) => { setDraft((d) => ({ ...d, [key]: e.target.value })); setError(''); }}
      />
    </div>
  );

  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
        Cadastre seu cartão de crédito para ver a fatura e o limite livre.
      </p>
      <div style={{ maxWidth: '480px' }}>
        <label style={LABEL_STYLE}>Nome</label>
        <input className="w-full text-sm" placeholder="Ex.: Nubank Cartão" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="mt-6 grid gap-x-10 gap-y-6" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {field('limit', 'Limite (R$)', 'ex: 5.000', 'decimal')}
          {field('closingDay', 'Fechamento', 'dia', 'numeric')}
          {field('dueDay', 'Vencimento', 'dia', 'numeric')}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <button type="button" onClick={create} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Cadastrar cartão
        </button>
        {error ? <span style={{ fontSize: '12px', color: 'var(--hub-negative)' }}>{error}</span> : null}
      </div>
    </div>
  );
}

function CardEditor({ card, last, onSaved }: { card: FinanceCard; last: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<CardDraft>(toDraft(card));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof CardDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaved(false);
    setError('');
  }

  function save() {
    const parsed = parseDraft(draft);
    if (typeof parsed === 'string') return setError(parsed);
    // An empty field clears the value (it used to be silently kept).
    cardService.updateCard(card.id, parsed);
    setSaved(true);
    onSaved();
  }

  const hasChanges =
    draft.limit !== (card.limit != null ? String(card.limit) : '') ||
    draft.closingDay !== (card.closingDay != null ? String(card.closingDay) : '') ||
    draft.dueDay !== (card.dueDay != null ? String(card.dueDay) : '');

  return (
    <div style={{ paddingBottom: '32px', marginBottom: last ? 0 : '32px', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <p style={{ fontSize: '15px', color: 'var(--hub-text)', marginBottom: '4px' }}>{card.name}</p>
      <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginBottom: '24px' }}>
        {card.type === 'credit' ? 'Crédito' : card.type === 'debit' ? 'Débito' : 'Virtual'}
      </p>

      <div className="grid gap-x-10 gap-y-6" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', maxWidth: '480px' }}>
        <div>
          <label style={LABEL_STYLE}>Limite (R$)</label>
          <input
            inputMode="decimal"
            placeholder="ex: 5.000"
            className={INPUT_CLASS}
            value={draft.limit}
            onChange={(e) => set('limit', e.target.value)}
          />
          {draft.limit === '' && (
            <p style={{ fontSize: '11px', color: 'var(--hub-disabled)', marginTop: '4px' }}>
              Não configurado
            </p>
          )}
        </div>

        <div>
          <label style={LABEL_STYLE}>Fechamento</label>
          <input
            inputMode="numeric"
            placeholder="ex: 5"
            className={INPUT_CLASS}
            value={draft.closingDay}
            onChange={(e) => set('closingDay', e.target.value)}
          />
          <p style={{ fontSize: '11px', color: 'var(--hub-disabled)', marginTop: '4px' }}>
            Dia do mês
          </p>
        </div>

        <div>
          <label style={LABEL_STYLE}>Vencimento</label>
          <input
            inputMode="numeric"
            placeholder="ex: 12"
            className={INPUT_CLASS}
            value={draft.dueDay}
            onChange={(e) => set('dueDay', e.target.value)}
          />
          <p style={{ fontSize: '11px', color: 'var(--hub-disabled)', marginTop: '4px' }}>
            Dia do mês
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 mt-5">
        <button
          onClick={save}
          disabled={!hasChanges}
          style={{
            color: hasChanges ? 'var(--hub-accent)' : 'var(--hub-disabled)',
            background: 'none',
            border: 'none',
            cursor: hasChanges ? 'pointer' : 'default',
            fontSize: '13px',
            fontWeight: 500,
            padding: 0,
          }}
          className="transition-opacity hover:opacity-70"
        >
          Salvar
        </button>
        {error && (
          <span style={{ fontSize: '12px', color: 'var(--hub-negative)' }}>{error}</span>
        )}
        {saved && !hasChanges && (
          <span style={{ fontSize: '11px', color: 'var(--hub-positive)' }}>Salvo</span>
        )}
      </div>
    </div>
  );
}

function creditCards(cards: FinanceCard[]) {
  return cards.filter((card) => card.type === 'credit' && card.isActive);
}

/** Limit, closing and due day of every card — the Configurar side of the Cartão tab. */
/** `onSaved` lets the page refresh what reads the card (the financial month shortcut). */
export function CardSettingsCard({ onSaved }: { onSaved?: () => void } = {}) {
  const [, forceUpdate] = useState(0);
  const [adding, setAdding] = useState(false);
  const cards = cardService.listCards();
  const refresh = () => { forceUpdate((n) => n + 1); onSaved?.(); };

  return (
    <Card>
      <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
        Cartões
      </p>
      {creditCards(cards).length === 0 ? (
        <NewCardForm onCreated={refresh} />
      ) : (
        <>
          {cards.map((card, i) => (
            <CardEditor key={card.id} card={card} last={i === cards.length - 1 && !adding} onSaved={refresh} />
          ))}
          {adding ? (
            <NewCardForm onCreated={() => { setAdding(false); refresh(); }} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              + Outro cartão
            </button>
          )}
        </>
      )}
    </Card>
  );
}
