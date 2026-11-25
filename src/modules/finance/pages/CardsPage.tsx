import { Link, useSearchParams } from 'react-router-dom';
import { ModuleHeader, Card } from '../../../shared/ui';
import { getFinanceTabs } from '../components/financeTabs';
import { CurrentInvoiceCard, InvoiceHistoryCard } from '../components/InvoiceSections';
import { invoiceService, type InstallmentPlan } from '../services/invoiceService';
import { transactionService } from '../services/transactionService';
import { formatCurrency } from '../utils/financeFormatters';

function fmtMonthShort(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-');
  return new Date(`${y}-${m}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function InstallmentPlansSection({ plans }: { plans: InstallmentPlan[] }) {
  if (plans.length === 0) return null;

  const totalBlocking = plans.reduce((s, p) => s + p.remaining * p.transaction.installmentValue!, 0);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: '8px' }}>
        <p className="font-medium uppercase" style={{ fontSize: '11px', letterSpacing: '0.13em', color: 'var(--hub-subtle)' }}>
          Parcelamentos
        </p>
        <span className="tabular-nums text-xs" style={{ color: 'var(--hub-subtle)' }}>
          {formatCurrency(totalBlocking)} a pagar
        </span>
      </div>

      {plans.map(({ transaction: t, remaining, current, endMonth }, i) => (
        <div
          key={t.id}
          className="flex items-start justify-between gap-4"
          style={{ padding: '10px 0', borderBottom: i === plans.length - 1 ? 'none' : '1px solid var(--hub-border)' }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm" style={{ color: 'var(--hub-text)', marginBottom: '2px' }}>{t.description}</p>
            <p className="tabular-nums" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
              parcela {current}/{t.installmentCount} · até {fmtMonthShort(endMonth)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular-nums text-sm" style={{ color: 'var(--hub-text-body)' }}>
              {formatCurrency(remaining * t.installmentValue!)}
            </p>
            <p className="tabular-nums" style={{ fontSize: '11px', color: 'var(--hub-subtle)' }}>
              {remaining}× {formatCurrency(t.installmentValue!)}
            </p>
          </div>
        </div>
      ))}
    </Card>
  );
}

export function CardsPage() {
  const pendingReviewCount = transactionService.listCurrentMonthReviewTransactions().length;
  const [searchParams, setSearchParams] = useSearchParams();
  const cards = invoiceService.listCreditCards();
  // The card in the URL, so a push or a bookmark opens the right one.
  const usage = invoiceService.getCardUsage(searchParams.get('card') ?? undefined);

  function selectCard(cardId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('card', cardId);
    setSearchParams(next, { replace: true });
  }
  const header = <ModuleHeader eyebrow="Módulo · Financeiro" title="Cartão" tabs={getFinanceTabs(pendingReviewCount)} />;

  if (!usage) {
    return (
      <div>
        {header}
        <Card>
          <p className="text-sm" style={{ color: 'var(--hub-text-body)' }}>Nenhum cartão de crédito cadastrado.</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--hub-subtle)' }}>
            Com o limite, o fechamento e o vencimento, o Olimpo mostra a fatura a pagar e o limite livre.
          </p>
          <Link to="/financeiro/configurar" className="mt-3 inline-block text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--hub-accent)' }}>
            Cadastrar cartão →
          </Link>
        </Card>
      </div>
    );
  }

  const { card } = usage;
  const missing = [card.limit == null && 'o limite', card.closingDay == null && 'o fechamento', card.dueDay == null && 'o vencimento'].filter(Boolean);

  return (
    <div>
      {header}

      {cards.length > 1 ? (
        <div className="hub-scroll-strip mb-5 flex gap-5 overflow-x-auto" style={{ borderBottom: '1px solid var(--hub-border)' }}>
          {cards.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`hub-tab shrink-0${item.id === card.id ? ' active' : ''}`}
              aria-pressed={item.id === card.id}
              onClick={() => selectCard(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}

      <CurrentInvoiceCard usage={usage} />

      {missing.length > 0 ? (
        <p className="mb-5 text-sm" style={{ color: 'var(--hub-muted)' }}>
          Falta informar {missing.join(', ').replace(/, ([^,]*)$/, ' e $1')} do cartão.{' '}
          <Link to="/financeiro/configurar" style={{ color: 'var(--hub-accent)' }} className="transition-opacity hover:opacity-70">
            Configurar →
          </Link>
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        <InstallmentPlansSection plans={invoiceService.listInstallmentPlans(card.id)} />
        <InvoiceHistoryCard key={card.id} cardId={card.id} exclude={usage.toPay?.id} />
      </div>
    </div>
  );
}
