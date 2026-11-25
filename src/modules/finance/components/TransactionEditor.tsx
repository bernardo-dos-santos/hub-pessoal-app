import { type FormEvent, useState } from 'react';
import { DateInput, Select } from '../../../shared/ui';
import { localDayKey } from '../../../shared/dates/localDay';
import { inferKindFromCategory } from '../services/transactionNormalizationService';
import { transactionService, type SplitPart } from '../services/transactionService';
import { type AccountType, type TransactionKind, type TransactionMethod } from '../types/finance';
import { type Transaction } from '../types/transaction';
import { formatCurrency, formatTransactionKind, formatTransactionMethod } from '../utils/financeFormatters';
import { parseMoneyText } from '../utils/moneyParsing';

export const KIND_OPTIONS: TransactionKind[] = [
  'expense',
  'income',
  'card_purchase',
  'refund',
  'transfer',
  'card_payment',
  'investment_contribution',
  'investment_withdrawal',
];

// Method is the payment instrument (débito/crédito/pix…), a separate axis from kind.
export const METHOD_OPTIONS: TransactionMethod[] = ['pix', 'debito', 'credito', 'boleto', 'fatura', 'transferencia', 'dinheiro', 'outro'];

const LABEL_STYLE = {
  fontSize: '11px',
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'var(--hub-subtle)',
  fontWeight: 500,
} as const;

const textButton = (color: string) => ({ color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }) as const;

function formatInputAmount(value: number) {
  return Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function accountTypeFor(method: TransactionMethod): AccountType {
  if (method === 'credito') return 'credit_card';
  if (method === 'dinheiro') return 'cash';
  return 'checking';
}

type Draft = {
  description: string;
  amount: string;
  /** Spending leaves (-), income comes in (+). */
  direction: 'out' | 'in';
  date: string;
  category: string;
  kind: TransactionKind;
  /** The person chose the type: a later category change must not overwrite it. */
  kindTouched: boolean;
  method: TransactionMethod;
  notes: string;
  needsReview: boolean;
};

function draftFrom(transaction: Transaction | null, defaultCategory: string): Draft {
  if (!transaction) {
    return {
      description: '',
      amount: '',
      direction: 'out',
      date: localDayKey(),
      category: defaultCategory,
      kind: 'expense',
      kindTouched: false,
      method: 'pix',
      notes: '',
      needsReview: false,
    };
  }
  return {
    description: transaction.description,
    amount: formatInputAmount(transaction.amount),
    direction: transaction.amount < 0 ? 'out' : 'in',
    date: transaction.date,
    category: transaction.category,
    kind: transaction.kind,
    kindTouched: false,
    method: transaction.method,
    notes: transaction.notes ?? '',
    needsReview: transaction.needsReview,
  };
}

type TransactionEditorProps = {
  /** null = a new manual entry. */
  transaction: Transaction | null;
  categoryOptions: string[];
  /** Called after a save, delete or split, with what to tell the person and how to undo it. */
  onDone: (result: { text: string; undo?: () => void; date?: string }) => void;
  onCancel: () => void;
};

/**
 * One form for a new manual entry and for correcting any line in Gastos:
 * description, amount, date, category, type, method and notes — plus delete
 * and split for an existing one.
 */
export function TransactionEditor({ transaction, categoryOptions, onDone, onCancel }: TransactionEditorProps) {
  const isNew = transaction === null;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(transaction, categoryOptions.includes('Outros') ? 'Outros' : categoryOptions[0] ?? 'Outros'));
  const [error, setError] = useState('');
  const [splitting, setSplitting] = useState(false);
  const [parts, setParts] = useState<{ amount: string; category: string }[]>([]);

  function signedAmount(): number | null {
    const value = parseMoneyText(draft.amount);
    if (value === null || !(Math.abs(value) > 0)) return null;
    return draft.direction === 'out' ? -Math.abs(value) : Math.abs(value);
  }

  function inferredKind(category: string, amount: number, method: TransactionMethod) {
    const base: TransactionKind = amount < 0 ? (method === 'credito' ? 'card_purchase' : 'expense') : 'income';
    return inferKindFromCategory(category, base, amount, draft.description);
  }

  function setCategory(category: string) {
    const amount = signedAmount() ?? (draft.direction === 'out' ? -1 : 1);
    setDraft({ ...draft, category, kind: draft.kindTouched ? draft.kind : inferredKind(category, amount, draft.method) });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = signedAmount();
    if (!draft.description.trim()) return setError('Dê um nome ao lançamento.');
    if (amount === null) return setError('Valor inválido — use algo como 45,90 ou 1.200.');
    if (!draft.date) return setError('Escolha a data.');
    setError('');
    const kind = draft.kindTouched || !isNew ? draft.kind : inferredKind(draft.category, amount, draft.method);

    if (isNew) {
      const created = transactionService.createTransaction({
        date: draft.date,
        description: draft.description.trim(),
        amount,
        category: draft.category,
        kind,
        method: draft.method,
        accountType: accountTypeFor(draft.method),
        scope: 'pessoal',
        source: 'manual',
        notes: draft.notes.trim() || undefined,
        manualCategory: true,
        needsReview: false,
        classificationConfidence: 'high',
        classificationReason: 'Lançado à mão.',
      });
      onDone({ text: `${created.description} lançado.`, undo: () => transactionService.deleteTransaction(created.id), date: created.date });
      return;
    }

    const before = transaction;
    transactionService.editTransaction(transaction.id, {
      description: draft.description.trim(),
      amount,
      date: draft.date,
      category: draft.category,
      kind,
      method: draft.method,
      notes: draft.notes.trim() || undefined,
      needsReview: draft.needsReview,
    });
    onDone({ text: 'Lançamento atualizado.', undo: () => restore(before), date: draft.date });
  }

  function restore(previous: Transaction) {
    transactionService.replaceTransactions(
      transactionService.listTransactions().map((item) => (item.id === previous.id ? previous : item)),
    );
  }

  function handleDelete() {
    if (!transaction) return;
    // No confirmation dialog: the result line offers "Desfazer", which is kinder than asking first.
    const removed = transactionService.deleteTransaction(transaction.id);
    if (removed) onDone({ text: `${removed.description} excluído.`, undo: () => transactionService.restoreTransaction(removed) });
  }

  function startSplit() {
    if (!transaction) return;
    const total = Math.abs(transaction.amount);
    setParts([
      { amount: formatInputAmount(total), category: transaction.category },
      { amount: '', category: categoryOptions.find((option) => option !== transaction.category) ?? transaction.category },
    ]);
    setSplitting(true);
    setError('');
  }

  const total = transaction ? Math.abs(transaction.amount) : 0;
  const parsedParts = parts.map((part) => parseMoneyText(part.amount) ?? 0);
  const otherPartsSum = parsedParts.slice(1).reduce((sum, value) => sum + Math.abs(value), 0);
  // The first part is what is left: typing the others is all it takes.
  const firstPart = Math.round((total - otherPartsSum) * 100) / 100;

  function confirmSplit() {
    if (!transaction) return;
    const splitParts: SplitPart[] = [
      { amount: firstPart, category: parts[0].category },
      ...parts.slice(1).map((part, index) => ({ amount: Math.abs(parsedParts[index + 1]), category: part.category })),
    ];
    try {
      const before = transactionService.listTransactions();
      transactionService.splitTransaction(transaction.id, splitParts);
      onDone({ text: `Dividido em ${splitParts.length} partes.`, undo: () => transactionService.replaceTransactions(before) });
    } catch (splitError) {
      setError(splitError instanceof Error ? splitError.message : 'Não foi possível dividir.');
    }
  }

  const categoryList = [...new Set([draft.category, ...categoryOptions])];

  return (
    <form className="grid gap-5" style={{ padding: '14px 2px 18px', borderTop: isNew ? undefined : '1px solid var(--hub-border)' }} onSubmit={handleSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span style={LABEL_STYLE}>Descrição</span>
          <input className="w-full" value={draft.description} placeholder="Ex.: Feira, Uber, aluguel" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>
        <div className="space-y-1.5">
          <span style={LABEL_STYLE}>Valor</span>
          <div className="flex items-end gap-3">
            <div className="flex shrink-0 gap-3 pb-1.5" role="group" aria-label="Gasto ou entrada">
              {(['out', 'in'] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-pressed={draft.direction === direction}
                  className={`hub-tab ${draft.direction === direction ? 'active' : ''}`}
                  style={{ fontSize: '12px', paddingBottom: '2px' }}
                  onClick={() => setDraft({ ...draft, direction })}
                >
                  {direction === 'out' ? 'Gasto' : 'Entrada'}
                </button>
              ))}
            </div>
            <input
              className="w-full tabular-nums"
              inputMode="decimal"
              placeholder="0,00"
              value={draft.amount}
              onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
            />
          </div>
        </div>
        <label className="space-y-1.5">
          <span style={LABEL_STYLE}>Data</span>
          <DateInput className="w-full" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} ariaLabel="Data do lançamento" />
        </label>
        <label className="space-y-1.5">
          <span style={LABEL_STYLE}>Categoria</span>
          <Select className="w-full" value={draft.category} onChange={setCategory}>
            {categoryList.map((option) => (
              <Select.Option key={option} value={option}>{option}</Select.Option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span style={LABEL_STYLE}>Forma</span>
          <Select className="w-full" value={draft.method} onChange={(value) => setDraft({ ...draft, method: value as TransactionMethod })}>
            {METHOD_OPTIONS.map((option) => (
              <Select.Option key={option} value={option}>{formatTransactionMethod(option)}</Select.Option>
            ))}
          </Select>
        </label>
        <label className="space-y-1.5">
          <span style={LABEL_STYLE}>Tipo</span>
          <Select className="w-full" value={draft.kind} onChange={(value) => setDraft({ ...draft, kind: value as TransactionKind, kindTouched: true })}>
            {/* 'review' and 'pagamento recebido' are internal states: listed only when the line already has one. */}
            {[...new Set([draft.kind, ...KIND_OPTIONS])].map((option) => (
              <Select.Option key={option} value={option}>{formatTransactionKind(option)}</Select.Option>
            ))}
          </Select>
        </label>
        {!isNew ? (
          <label className="flex cursor-pointer items-center gap-2 sm:pt-5" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
            <input className="h-3.5 w-3.5 rounded" type="checkbox" checked={draft.needsReview} onChange={(event) => setDraft({ ...draft, needsReview: event.target.checked })} />
            ainda precisa de revisão
          </label>
        ) : null}
      </div>
      <label className="space-y-1.5">
        <span style={LABEL_STYLE}>Notas</span>
        <textarea className="w-full leading-6 resize-none" rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      </label>

      {splitting && transaction ? (
        <div className="grid gap-3" style={{ padding: '14px', borderRadius: 'var(--hub-radius-card)', background: 'var(--hub-surface-muted)' }}>
          <p style={LABEL_STYLE}>Dividir {formatCurrency(total)}</p>
          {parts.map((part, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end gap-3">
              {index === 0 ? (
                <span className="pb-1.5 text-sm tabular-nums" style={{ color: firstPart > 0 ? 'var(--hub-text)' : 'var(--hub-negative)' }} aria-label="Valor que sobra para a primeira parte">
                  {formatCurrency(firstPart)}
                </span>
              ) : (
                <input
                  className="w-full tabular-nums"
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label={`Valor da parte ${index + 1}`}
                  value={part.amount}
                  onChange={(event) => setParts(parts.map((item, i) => (i === index ? { ...item, amount: event.target.value } : item)))}
                />
              )}
              <Select
                className="w-full"
                aria-label={`Categoria da parte ${index + 1}`}
                value={part.category}
                onChange={(category) => setParts(parts.map((item, i) => (i === index ? { ...item, category } : item)))}
              >
                {[...new Set([part.category, ...categoryOptions])].map((option) => (
                  <Select.Option key={option} value={option}>{option}</Select.Option>
                ))}
              </Select>
              {index > 1 ? (
                <button type="button" className="pb-1.5 text-xs" style={textButton('var(--hub-subtle)')} aria-label={`Remover parte ${index + 1}`} onClick={() => setParts(parts.filter((_, i) => i !== index))}>
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" className="text-xs font-medium" style={textButton('var(--hub-accent)')} onClick={() => setParts([...parts, { amount: '', category: categoryOptions[0] ?? 'Outros' }])}>
              + parte
            </button>
            <button type="button" className="text-sm font-medium transition-opacity hover:opacity-70" style={textButton('var(--hub-accent)')} disabled={!(firstPart > 0)} onClick={confirmSplit}>
              Confirmar divisão
            </button>
            <button type="button" className="text-xs" style={textButton('var(--hub-subtle)')} onClick={() => setSplitting(false)}>
              cancelar divisão
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p style={{ fontSize: '12px', color: 'var(--hub-negative)' }} role="alert">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-5">
        <button className="text-sm font-medium transition-opacity hover:opacity-70" style={textButton('var(--hub-accent)')} type="submit">
          {isNew ? 'Lançar' : 'Salvar'}
        </button>
        <button className="text-xs transition-opacity hover:opacity-60" style={textButton('var(--hub-subtle)')} type="button" onClick={onCancel}>
          cancelar
        </button>
        {!isNew && !splitting ? (
          <>
            <button className="text-xs font-medium transition-opacity hover:opacity-70" style={textButton('var(--hub-text-body)')} type="button" onClick={startSplit}>
              Dividir
            </button>
            <button className="ml-auto text-xs font-medium transition-opacity hover:opacity-70" style={textButton('var(--hub-negative)')} type="button" onClick={handleDelete}>
              Excluir
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
