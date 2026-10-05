import { useState } from 'react';
import { ModuleHeader, Card } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { CurrentInvoiceCard, InvoiceHistoryCard } from '../components/InvoiceSections';
import { cardService } from '../services/cardService';
import { transactionService } from '../services/transactionService';
import type { Card as FinanceCard } from '../types/card';
import type { Transaction } from '../types/transaction';

function monthsBetween(fromYYYYMM: string, toYYYYMM: string): number {
  const [fy, fm] = fromYYYYMM.split('-').map(Number);
  const [ty, tm] = toYYYYMM.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function addMonths(yyyyMM: string, n: number): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function remainingInstallments(purchaseDate: string, count: number, currentMonth: string): number {
  const elapsed = monthsBetween(purchaseDate.slice(0, 7), currentMonth);
  const paid = Math.max(0, elapsed - 1);
  return Math.max(0, count - paid);
}

function fmtMonthShort(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-');
  return new Date(`${y}-${m}-15`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

const INPUT_CLASS = 'w-full bg-transparent pb-1.5 text-sm outline-none tabular-nums';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
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

function CardEditor({ card, last, onSaved }: { card: FinanceCard; last: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<CardDraft>(toDraft(card));
  const [saved, setSaved] = useState(false);

  function set(field: keyof CardDraft, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setSaved(false);
  }

  function save() {
    const limit = draft.limit !== '' ? parseFloat(draft.limit.replace(',', '.')) : undefined;
    const closingDay = draft.closingDay !== '' ? parseInt(draft.closingDay) : undefined;
    const dueDay = draft.dueDay !== '' ? parseInt(draft.dueDay) : undefined;

    if (limit !== undefined && (isNaN(limit) || limit <= 0)) return;
    if (closingDay !== undefined && (isNaN(closingDay) || closingDay < 1 || closingDay > 28)) return;
    if (dueDay !== undefined && (isNaN(dueDay) || dueDay < 1 || dueDay > 28)) return;

    cardService.updateCard(card.id, {
      ...(limit !== undefined && { limit }),
      ...(closingDay !== undefined && { closingDay }),
      ...(dueDay !== undefined && { dueDay }),
    });
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
        {card.accountId ? ` · ID: ${card.accountId}` : ''}
      </p>

      <div className="grid gap-x-10 gap-y-6" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', maxWidth: '480px' }}>
        <div>
          <label style={LABEL_STYLE}>Limite (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="ex: 5000"
            className={INPUT_CLASS}
            value={draft.limit}
            onChange={(e) => set('limit', e.target.value)}
          />
          {draft.limit === '' && (
            <p style={{ fontSize: '10px', color: 'var(--hub-disabled)', marginTop: '4px' }}>
              Não configurado
            </p>
          )}
        </div>

        <div>
          <label style={LABEL_STYLE}>Fechamento</label>
          <input
            type="number"
            min="1"
            max="28"
            placeholder="ex: 5"
            className={INPUT_CLASS}
            value={draft.closingDay}
            onChange={(e) => set('closingDay', e.target.value)}
          />
          <p style={{ fontSize: '10px', color: 'var(--hub-disabled)', marginTop: '4px' }}>
            Dia do mês
          </p>
        </div>

        <div>
          <label style={LABEL_STYLE}>Vencimento</label>
          <input
            type="number"
            min="1"
            max="28"
            placeholder="ex: 12"
            className={INPUT_CLASS}
            value={draft.dueDay}
            onChange={(e) => set('dueDay', e.target.value)}
          />
          <p style={{ fontSize: '10px', color: 'var(--hub-disabled)', marginTop: '4px' }}>
            Dia do mês
          </p>
        </div>
      </div>

      {draft.limit !== '' && !isNaN(parseFloat(draft.limit)) && (
        <p style={{ fontSize: '11px', color: 'var(--hub-subtle)', marginTop: '14px' }}>
          Compras no crédito reduzem o limite · pagamento da fatura reduz o saldo e restaura o limite
        </p>
      )}

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
        {saved && !hasChanges && (
          <span style={{ fontSize: '11px', color: 'var(--hub-positive)' }}>Salvo</span>
        )}
      </div>
    </div>
  );
}

function InstallmentPlansSection({ transactions, currentMonth }: { transactions: Transaction[]; currentMonth: string }) {
  const plans = transactions
    .filter((t) => t.kind === 'card_purchase' && t.installmentCount != null && t.installmentValue != null)
    .map((t) => {
      const remaining = remainingInstallments(t.date, t.installmentCount!, currentMonth);
      return { t, remaining, blocking: remaining * t.installmentValue! };
    })
    .filter((p) => p.remaining > 0)
    .sort((a, b) => a.t.date.localeCompare(b.t.date));

  if (plans.length === 0) return null;

  const totalBlocking = plans.reduce((s, p) => s + p.blocking, 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between" style={{ marginBottom: '16px' }}>
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
          Parcelamentos ativos
        </p>
        <span className="tabular-nums text-sm" style={{ color: 'var(--hub-negative)', fontWeight: 300 }}>
          {fmtBRL(totalBlocking)} bloqueando limite
        </span>
      </div>

      <div>
        {plans.map(({ t, remaining }, i) => {
          const purchaseMonth = t.date.slice(0, 7);
          const paid = Math.max(0, monthsBetween(purchaseMonth, currentMonth) - 1);
          const current = paid + 1;
          const endMonth = addMonths(purchaseMonth, t.installmentCount!);
          return (
            <div
              key={t.id}
              className="flex items-start justify-between"
              style={{ paddingTop: '10px', paddingBottom: '10px', borderBottom: i === plans.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <div className="min-w-0 mr-4">
                <p className="truncate text-sm" style={{ color: 'var(--hub-text)', marginBottom: '2px' }}>{t.description}</p>
                <p style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                  parcela {current}/{t.installmentCount} · até {fmtMonthShort(endMonth)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums text-sm" style={{ color: 'var(--hub-negative)' }}>
                  {fmtBRL(remaining * t.installmentValue!)}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
                  {remaining}× {fmtBRL(t.installmentValue!)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function CardsPage() {
  const [, forceUpdate] = useState(0);
  const pendingReviewCount = transactionService.listRequiredReviewTransactions().length;
  const cards = cardService.listCards();
  const transactions = transactionService.listTransactions();
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Cartões" tabs={getFinanceTabs(pendingReviewCount)} />

      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Fatura aberta e histórico abaixo. Configure limite, fechamento e vencimento para o hub calcular o limite disponível e derivar faturas.
      </p>

      <CurrentInvoiceCard />

      <Card className="mb-5">
        {cards.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--hub-subtle)' }}>
            Nenhum cartão cadastrado.
          </p>
        ) : (
          <div>
            {cards.map((card, i) => (
              <CardEditor
                key={card.id}
                card={card}
                last={i === cards.length - 1}
                onSaved={() => forceUpdate((n) => n + 1)}
              />
            ))}
          </div>
        )}
      </Card>

      <InstallmentPlansSection transactions={transactions} currentMonth={currentMonth} />

      <div className="mt-5">
        <InvoiceHistoryCard />
      </div>
    </div>
  );
}
