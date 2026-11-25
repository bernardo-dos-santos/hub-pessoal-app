import { useState } from 'react';
import { Card } from '../../../shared/ui';
import { invoiceService, type CardUsage } from '../services/invoiceService';
import { type Invoice } from '../types/invoice';
import { formatCurrency, formatDate } from '../utils/financeFormatters';

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const sectionLabel: React.CSSProperties = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' };

function formatInvoiceLabel(invoice: Invoice) {
  return `${MONTHS_PT[invoice.month - 1]}/${invoice.year}`;
}

function statusLabel(status: Invoice['status']) {
  if (status === 'paid') return 'paga';
  if (status === 'closed') return 'fechada';
  return 'aberta';
}

function statusColor(status: Invoice['status']) {
  if (status === 'paid') return 'var(--hub-positive)';
  if (status === 'closed') return 'var(--hub-warning)';
  return 'var(--hub-subtle)';
}

/** Whole days from today to a YYYY-MM-DD date, both at local midnight (0 = today). */
function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(year, month - 1, day).getTime() - today.getTime()) / 86_400_000);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function dueText(dueDate?: string): { text: string; color: string } | null {
  const d = daysUntil(dueDate);
  if (d === null) return null;
  if (d > 0) return { text: `vence em ${plural(d, 'dia')}`, color: d <= 3 ? 'var(--hub-warning)' : 'var(--hub-subtle)' };
  if (d === 0) return { text: 'vence hoje', color: 'var(--hub-warning)' };
  return { text: `venceu há ${plural(-d, 'dia')} — se já pagou, importe o extrato da conta`, color: 'var(--hub-negative)' };
}

function closingText(closingDate?: string): string | null {
  const d = daysUntil(closingDate);
  if (d === null) return null;
  return d > 0 ? `fecha em ${plural(d, 'dia')}` : d === 0 ? 'fecha hoje' : 'fechada';
}

/**
 * The card's answer: the bill to pay now when the last one closed unpaid, else the
 * open one — with the limit that is really left. A closed bill used to show only
 * as a line in the history, while the hero was the open bill nobody has to pay yet.
 */
export function CurrentInvoiceCard({ usage }: { usage: CardUsage }) {
  const { open, toPay, card } = usage;
  const hero = toPay ?? open;

  if (!hero) {
    return (
      <Card className="mb-5">
        <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
          Informe o fechamento e o vencimento do cartão para ver a fatura.
        </p>
      </Card>
    );
  }

  const due = dueText(hero.dueDate);

  return (
    <Card className="mb-5" hero>
      <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '16px' }}>
        {toPay ? `Fatura a pagar — ${formatInvoiceLabel(toPay)}` : `Fatura aberta — ${formatInvoiceLabel(hero)}`}
      </p>

      <p
        className="tabular-nums"
        style={{ fontSize: '44px', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--hub-text)', lineHeight: 1 }}
      >
        {formatCurrency(hero.total)}
      </p>

      <p className="tabular-nums" style={{ fontSize: '12px', marginTop: '10px', color: 'var(--hub-subtle)' }}>
        {!toPay && closingText(hero.closingDate) ? <>{closingText(hero.closingDate)} · </> : null}
        {due ? <span style={{ color: due.color }}>{due.text}</span> : null}
      </p>

      {toPay && open ? (
        <p className="tabular-nums" style={{ fontSize: '12px', marginTop: '4px', color: 'var(--hub-subtle)' }}>
          Próxima, aberta: {formatCurrency(open.total)}
          {closingText(open.closingDate) ? ` · ${closingText(open.closingDate)}` : ''}
        </p>
      ) : null}

      {usage.free != null ? <LimitBar limit={card.limit!} used={usage.used} free={usage.free} installmentsAhead={usage.installmentsAhead} /> : null}

      <InvoiceTransactionList invoice={hero} />
    </Card>
  );
}

function LimitBar({ limit, used, free, installmentsAhead }: { limit: number; used: number; free: number; installmentsAhead: number }) {
  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ height: '4px', background: 'var(--hub-track)', borderRadius: 'var(--hub-radius-control)' }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, Math.round((used / limit) * 100)))}%`,
            height: '4px',
            borderRadius: 'var(--hub-radius-control)',
            background: free < 0 ? 'var(--hub-negative)' : 'var(--hub-accent)',
          }}
        />
      </div>
      <p className="tabular-nums" style={{ fontSize: '12px', color: free < 0 ? 'var(--hub-negative)' : 'var(--hub-subtle)', marginTop: '6px' }}>
        {free < 0 ? `${formatCurrency(-free)} acima do limite` : `${formatCurrency(free)} de limite livre`} de {formatCurrency(limit)}
        {installmentsAhead > 0 ? ` · ${formatCurrency(installmentsAhead)} presos em parcelas` : ''}
      </p>
    </div>
  );
}

/** Histórico de faturas fechadas/pagas, cada uma expansível pra ver as transações do período. */
export function InvoiceHistoryCard({ cardId, exclude }: { cardId: string; exclude?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const invoices = invoiceService.listInvoices(cardId);
  // A closed bill of R$ 0 (a month without card use) is just noise in the history,
  // and the one shown as the hero isn't repeated here.
  const past = invoices.filter((inv) => inv.status !== 'open' && inv.total > 0 && inv.id !== exclude);

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (past.length === 0) return null;

  return (
    <Card>
      <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '8px' }}>
        Histórico de faturas
      </p>
      {past.map((inv, i) => {
        const expanded = expandedId === inv.id;
        return (
          <div key={inv.id} style={{ borderBottom: i === past.length - 1 && !expanded ? 'none' : '1px solid var(--hub-border)' }}>
            <button
              type="button"
              onClick={() => toggle(inv.id)}
              aria-expanded={expanded}
              className="flex w-full items-baseline gap-2.5 text-left"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0' }}
            >
              <span className="tabular-nums" style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400 }}>
                {formatInvoiceLabel(inv)}
              </span>
              <span className="tabular-nums" style={{ fontSize: '14px', color: 'var(--hub-muted)' }}>
                {formatCurrency(inv.total)}
              </span>
              <span style={{ fontSize: '11px', color: statusColor(inv.status), marginLeft: 'auto' }}>
                {statusLabel(inv.status)} {expanded ? '▴' : '▾'}
              </span>
            </button>

            {expanded ? (
              <div style={{ marginBottom: '16px' }}>
                <InvoiceTransactionList invoice={inv} />
              </div>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}

const LIST_PREVIEW = 8;

function InvoiceTransactionList({ invoice }: { invoice: Invoice }) {
  const [showAll, setShowAll] = useState(false);
  const txs = invoiceService.getInvoiceTransactions(invoice);

  if (txs.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '12px' }}>
        Nenhuma compra no crédito neste período.
      </p>
    );
  }

  // A bill of 60 lines pushed the rest of the page out of reach on a phone.
  const shown = showAll ? txs : txs.slice(0, LIST_PREVIEW);

  return (
    <div style={{ marginTop: '16px' }}>
      {shown.map((tx, i) => {
        const refund = tx.kind === 'refund';
        return (
          <div
            key={tx.id}
            className="flex items-baseline gap-2"
            style={{
              paddingBottom: '10px',
              marginBottom: i === shown.length - 1 ? 0 : '10px',
              borderBottom: i === shown.length - 1 ? 'none' : '1px solid var(--hub-border)',
            }}
          >
            <span className="tabular-nums shrink-0" style={{ fontSize: '11px', color: 'var(--hub-subtle)', minWidth: '42px' }}>
              {formatDate(tx.date).slice(0, 5)}
            </span>
            <span className="min-w-0 flex-1 truncate" style={{ fontSize: '13px', color: 'var(--hub-text)' }}>
              {tx.description}
              {refund ? <span style={{ fontSize: '11px', color: 'var(--hub-positive)' }}> · estorno</span> : null}
              {tx.needsReview ? <span style={{ fontSize: '11px', color: 'var(--hub-warning)' }}> · a revisar</span> : null}
            </span>
            <span className="tabular-nums shrink-0" style={{ fontSize: '13px', color: refund ? 'var(--hub-positive)' : 'var(--hub-text-body)' }}>
              {refund ? '−' : ''}{formatCurrency(Math.abs(tx.amount))}
            </span>
          </div>
        );
      })}
      {txs.length > LIST_PREVIEW ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--hub-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {showAll ? 'mostrar menos' : `ver todas as ${txs.length}`}
        </button>
      ) : null}
    </div>
  );
}
