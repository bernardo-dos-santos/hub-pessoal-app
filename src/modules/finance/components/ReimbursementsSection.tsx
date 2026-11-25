import { useState } from 'react';
import { Card, Toast } from '../../../shared/ui';
import { reimbursementService, type ReimbursementRefundCandidate } from '../services/reimbursementService';
import { transactionService } from '../services/transactionService';
import { formatCurrency, formatDate } from '../utils/financeFormatters';
import { transactionMonthKey } from '../utils/financeCalculations';
import type { Transaction } from '../types/transaction';

const sectionLabel: React.CSSProperties = { fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' };

const linkButton: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0 };

type Notice = { text: string; undo: () => void };

/**
 * Reembolsos dentro de Gastos: pares encontrados e estornos que a detecção não
 * resolveu. It used to be read-only — a wrong pair, or a refund with no pair,
 * could only be looked at; now each one has its action, with "Desfazer".
 */
export function ReimbursementsSection({ month }: { month: string }) {
  const [, setVersion] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [choosingFor, setChoosingFor] = useState<string | null>(null);

  const inMonth = (transaction: Transaction) => month === 'all' || transactionMonthKey(transaction) === month;
  const pairs = reimbursementService.listReimbursementPairs().filter((pair) => inMonth(pair.refund));
  const candidates = reimbursementService.listUnmatchedRefundCandidates().filter((candidate) => inMonth(candidate.refund));
  const periodSuffix = month === 'all' ? '' : ' neste mês';

  /** Runs a change and offers to put every line back as it was. */
  function act(text: string, change: () => void) {
    const before = transactionService.listTransactions();
    change();
    setChoosingFor(null);
    setVersion((n) => n + 1);
    setNotice({
      text,
      undo: () => {
        transactionService.replaceTransactions(before);
        setNotice(null);
        setVersion((n) => n + 1);
      },
    });
  }

  return (
    <div>
      {notice ? (
        <Toast text={notice.text} onClose={() => setNotice(null)} actions={[{ label: 'Desfazer', onClick: notice.undo }]} />
      ) : null}

      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>
          Estornos sem par
        </p>
        <p className="mb-4" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
          Diga de qual compra é cada estorno — o par sai dos cálculos — ou que ele não tem par.
        </p>

        {candidates.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>Nenhum estorno esperando{periodSuffix}.</p>
        ) : (
          candidates.map((candidate, i) => (
            <CandidateRow
              key={candidate.refund.id}
              candidate={candidate}
              last={i === candidates.length - 1}
              choosing={choosingFor === candidate.refund.id}
              onChoose={() => setChoosingFor((current) => (current === candidate.refund.id ? null : candidate.refund.id))}
              onPair={(original) =>
                act(`Pareado com "${original.description}".`, () => reimbursementService.pairManually(original.id, candidate.refund.id))
              }
              onIgnore={() =>
                act('Estorno mantido sem par — ele abate o que você gastou.', () => reimbursementService.ignoreRefund(candidate.refund.id))
              }
            />
          ))
        )}
      </Card>

      <Card>
        <p className="font-medium uppercase" style={{ ...sectionLabel, marginBottom: '4px' }}>
          Pares encontrados
        </p>
        <p className="mb-4" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
          Compra e estorno que se anulam ficam no histórico e fora dos cálculos.
        </p>

        {pairs.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>Nenhum reembolso pareado{periodSuffix}.</p>
        ) : (
          pairs.map((pair, i) => (
            <div
              key={pair.pairId}
              className="flex items-start justify-between gap-4"
              style={{ padding: '12px 0', borderBottom: i === pairs.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm" style={{ color: 'var(--hub-text)' }}>{pair.original.description}</p>
                <p className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '2px' }}>
                  compra {formatDate(pair.original.date)} · estorno {formatDate(pair.refund.date)} · {pair.original.category}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums text-sm" style={{ color: 'var(--hub-muted)' }}>{formatCurrency(Math.abs(pair.original.amount))}</p>
                <button
                  type="button"
                  onClick={() => act('Par desfeito — as duas linhas voltam a contar.', () => reimbursementService.unpairReimbursementPair(pair.pairId))}
                  className="mt-1 text-xs transition-opacity hover:opacity-70"
                  style={{ ...linkButton, color: 'var(--hub-subtle)' }}
                >
                  não é este par
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function CandidateRow({
  candidate,
  last,
  choosing,
  onChoose,
  onPair,
  onIgnore,
}: {
  candidate: ReimbursementRefundCandidate;
  last: boolean;
  choosing: boolean;
  onChoose: () => void;
  onPair: (original: Transaction) => void;
  onIgnore: () => void;
}) {
  const { refund } = candidate;
  const suggestions = choosing ? reimbursementService.suggestOriginals(candidate) : [];

  return (
    <div style={{ padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--hub-border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm" style={{ color: 'var(--hub-text)' }}>{refund.description}</p>
          <p className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '2px' }}>
            {formatDate(refund.date)} · {refund.category}
            {candidate.status === 'ambiguous' ? <span style={{ color: 'var(--hub-warning)' }}> · mais de uma compra combina</span> : null}
          </p>
        </div>
        <p className="shrink-0 tabular-nums text-sm" style={{ color: 'var(--hub-positive)' }}>+{formatCurrency(refund.amount)}</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <button type="button" onClick={onChoose} aria-expanded={choosing} className="text-xs font-medium transition-opacity hover:opacity-70" style={{ ...linkButton, color: 'var(--hub-accent)' }}>
          {choosing ? 'fechar' : 'de qual compra?'}
        </button>
        <button type="button" onClick={onIgnore} className="text-xs transition-opacity hover:opacity-70" style={{ ...linkButton, color: 'var(--hub-subtle)' }}>
          não tem par
        </button>
      </div>

      {choosing ? (
        <div className="mt-3" style={{ paddingLeft: '12px', borderLeft: '2px solid var(--hub-border)' }}>
          {suggestions.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
              Nenhuma compra de {formatCurrency(refund.amount)} nos 60 dias antes. Se o estorno foi parcial, deixe sem par — ele já abate o gasto.
            </p>
          ) : (
            suggestions.map((original) => (
              <button
                key={original.id}
                type="button"
                onClick={() => onPair(original)}
                className="flex w-full items-baseline justify-between gap-3 text-left transition-opacity hover:opacity-70"
                style={{ ...linkButton, padding: '8px 0' }}
              >
                <span className="min-w-0 truncate text-sm" style={{ color: 'var(--hub-text-body)' }}>
                  {original.description}
                  <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}> · {formatDate(original.date)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-sm" style={{ color: 'var(--hub-negative)' }}>{formatCurrency(original.amount)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
