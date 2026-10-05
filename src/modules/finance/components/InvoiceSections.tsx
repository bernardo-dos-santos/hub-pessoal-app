import { useState } from 'react';
import { Card } from '../../../shared/ui';
import { invoiceService } from '../services/invoiceService';
import { type Invoice } from '../types/invoice';
import { formatCurrency, formatDate } from '../utils/financeFormatters';

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

/** Fatura aberta — total, dias até fechamento/vencimento e transações do período. */
export function CurrentInvoiceCard() {
  const invoices = invoiceService.listInvoices();
  const current = invoices.find((inv) => inv.status === 'open') ?? null;

  return (
    <Card className="mb-5">
      {current ? (
        <div>
          <p
            className="font-medium uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}
          >
            Fatura aberta — {formatInvoiceLabel(current)}
          </p>

          <p
            className="tabular-nums"
            style={{ fontSize: '44px', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--hub-text)', lineHeight: 1 }}
          >
            {formatCurrency(current.total)}
          </p>

          {(current.closingDate || current.dueDate) && (
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '10px' }}>
              {current.closingDate && (() => {
                const d = daysUntil(current.closingDate);
                if (d === null) return null;
                return d > 0 ? `Fecha em ${d} dia${d !== 1 ? 's' : ''}` : 'Fechada';
              })()}
              {current.closingDate && current.dueDate && ' · '}
              {current.dueDate && (() => {
                const d = daysUntil(current.dueDate);
                if (d === null) return null;
                return d > 0 ? `Vence em ${d} dia${d !== 1 ? 's' : ''}` : `Vencida`;
              })()}
            </p>
          )}

          <InvoiceTransactionList invoice={current} />
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
          Nenhuma fatura aberta no momento.
        </p>
      )}
    </Card>
  );
}

/** Histórico de faturas fechadas/pagas, cada uma expansível pra ver as transações do período. */
export function InvoiceHistoryCard() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const invoices = invoiceService.listInvoices();
  const past = invoices.filter((inv) => inv.status !== 'open');

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (past.length === 0) return null;

  return (
    <Card>
      <p
        className="font-medium uppercase"
        style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '16px' }}
      >
        Histórico de faturas
      </p>
      {past.map((inv, i) => (
        <div key={inv.id} style={{ borderBottom: i === past.length - 1 && expandedId !== inv.id ? 'none' : '1px solid var(--hub-border)' }}>
          <button
            onClick={() => toggle(inv.id)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0 16px',
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
              textAlign: 'left',
            }}
          >
            <span className="tabular-nums" style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400 }}>
              {formatInvoiceLabel(inv)}
            </span>
            <span className="tabular-nums" style={{ fontSize: '14px', color: 'var(--hub-muted)' }}>
              {formatCurrency(inv.total)}
            </span>
            <span style={{ fontSize: '11px', color: statusColor(inv.status), marginLeft: 'auto' }}>
              {statusLabel(inv.status)}
            </span>
          </button>

          {expandedId === inv.id && (
            <div style={{ marginBottom: '16px' }}>
              <InvoiceTransactionList invoice={inv} />
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

function InvoiceTransactionList({ invoice }: { invoice: Invoice }) {
  const txs = invoiceService.getInvoiceTransactions(invoice);

  if (txs.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--hub-disabled)', marginTop: '12px' }}>
        Nenhuma compra no crédito neste período.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '16px' }}>
      {txs.map((tx, i) => (
        <div
          key={tx.id}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            paddingBottom: '10px',
            marginBottom: i === txs.length - 1 ? 0 : '10px',
            borderBottom: i === txs.length - 1 ? 'none' : '1px solid var(--hub-border)',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--hub-subtle)', minWidth: '42px', flexShrink: 0 }}>
            {formatDate(tx.date).slice(0, 5)}
          </span>
          <span style={{ fontSize: '13px', color: 'var(--hub-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.description}
            {tx.needsReview && (
              <span
                title="Aguarda revisão"
                style={{
                  display: 'inline-block',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'var(--hub-warning)',
                  marginLeft: '6px',
                  verticalAlign: 'middle',
                  flexShrink: 0,
                }}
              />
            )}
          </span>
          <span
            className="tabular-nums"
            style={{ fontSize: '13px', color: 'var(--hub-negative)', flexShrink: 0 }}
          >
            {formatCurrency(Math.abs(tx.amount))}
          </span>
        </div>
      ))}
    </div>
  );
}
