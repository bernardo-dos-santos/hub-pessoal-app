import { Card } from '../../../shared/ui';
import { EmptyFinanceState } from './EmptyFinanceState';
import { reimbursementService } from '../services/reimbursementService';
import { formatCurrency, formatDate, formatTransactionKind } from '../utils/financeFormatters';

/** Visão de reembolsos dentro de Transações: pares encontrados, estornos sem par e casos ambíguos. */
export function ReimbursementsSection({ month }: { month: string }) {
  const pairs = reimbursementService
    .listReimbursementPairs()
    .filter((pair) => month === 'all' || pair.refund.date.startsWith(month));
  const candidates = reimbursementService
    .listUnmatchedRefundCandidates()
    .filter((candidate) => month === 'all' || candidate.refund.date.startsWith(month));
  const unmatchedCandidates = candidates.filter((candidate) => candidate.status === 'unmatched');
  const ambiguousCandidates = candidates.filter((candidate) => candidate.status === 'ambiguous');
  const periodSuffix = month === 'all' ? '.' : ' neste mês.';

  return (
    <div>
      <p className="mb-6 text-sm" style={{ color: 'var(--hub-muted)', maxWidth: '640px' }}>
        Confira pares encontrados, estornos sem par e casos ambíguos sem apagar transações.
      </p>

      <Card className="mb-5">
        <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '5px' }}>
          Pares encontrados
        </p>
        <p className="mb-5" style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>
          Compra e estorno com sinais fortes ficam no histórico e não entram nos cálculos.
        </p>

        {pairs.length === 0 ? (
          <EmptyFinanceState
            title={`Nenhum reembolso pareado${periodSuffix}`}
            description="Novas importações detectam pares seguros por valor exato, descrição, categoria, conta e janela curta."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {pairs.map((pair, i) => (
              <div key={pair.pairId} style={{ paddingBottom: i === pairs.length - 1 ? 0 : '24px', borderBottom: i === pairs.length - 1 ? 'none' : '1px solid var(--hub-border)' }}>
                <div className="grid gap-4 lg:grid-cols-2" style={{ marginBottom: '10px' }}>
                  <ReimbursementTransactionCard label="Compra original" transaction={pair.original} />
                  <ReimbursementTransactionCard label="Estorno" transaction={pair.refund} />
                </div>
                <p style={{ fontSize: '11px', color: 'color-mix(in srgb, var(--hub-accent) 75%, transparent)' }}>
                  Pareado · Fora dos cálculos · {pair.original.category}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <CandidateList
          candidates={unmatchedCandidates}
          emptyText={`Nenhum estorno sem par exato${periodSuffix}`}
          title="Estornos sem par exato"
        />
      </Card>
      <Card>
        <CandidateList
          candidates={ambiguousCandidates}
          emptyText={`Nenhum pareamento ambíguo${periodSuffix}`}
          title="Pareamentos ambíguos"
        />
      </Card>
    </div>
  );
}

function ReimbursementTransactionCard({
  label,
  transaction,
}: {
  label: string;
  transaction: ReturnType<typeof reimbursementService.listReimbursementPairs>[number]['original'];
}) {
  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--hub-subtle)', marginBottom: '7px' }}>
        {label}
      </p>
      <p style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400, marginBottom: '5px' }}>
        {transaction.description}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--hub-muted)', lineHeight: 1.5 }}>
        {formatDate(transaction.date)} · {formatTransactionKind(transaction.kind)} · {transaction.accountName ?? 'Sem conta'}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', lineHeight: 1.5 }}>
        {transaction.source}{transaction.institution ? ` · ${transaction.institution}` : ''}
      </p>
      <p
        className="tabular-nums"
        style={{ fontSize: '16px', fontWeight: 300, letterSpacing: '-0.015em', marginTop: '6px', color: transaction.amount < 0 ? 'var(--hub-negative)' : 'var(--hub-positive)' }}
      >
        {formatCurrency(transaction.amount)}
      </p>
    </div>
  );
}

function CandidateList({
  candidates,
  emptyText,
  title,
}: {
  candidates: ReturnType<typeof reimbursementService.listUnmatchedRefundCandidates>;
  emptyText: string;
  title: string;
}) {
  return (
    <div>
      <p className="font-medium uppercase" style={{ fontSize: '10px', letterSpacing: '0.13em', color: 'var(--hub-subtle)', marginBottom: '20px' }}>
        {title}
      </p>
      {candidates.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--hub-subtle)' }}>{emptyText}</p>
      ) : (
        <div>
          {candidates.map((candidate, i) => (
            <div
              key={candidate.refund.id}
              style={{ paddingBottom: '18px', marginBottom: i === candidates.length - 1 ? 0 : '18px', borderBottom: i === candidates.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
            >
              <p style={{ fontSize: '14px', color: 'var(--hub-text)', fontWeight: 400, marginBottom: '5px' }}>
                {candidate.refund.description}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--hub-muted)', marginBottom: '5px' }}>
                {formatDate(candidate.refund.date)} · {formatCurrency(candidate.refund.amount)} · {candidate.refund.category}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--hub-warning)' }}>
                {candidate.status === 'ambiguous' ? 'Pareamento ambíguo' : 'Estorno sem par exato'}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--hub-subtle)', marginTop: '3px' }}>{candidate.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
