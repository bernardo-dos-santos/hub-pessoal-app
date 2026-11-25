import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { invoiceService } from '../services/invoiceService';
import { transactionService } from '../services/transactionService';
import { budgetService } from '../services/budgetService';
import { BUDGET_ATTENTION_PERCENT, calculateBudgetUsage } from '../utils/financeCalculations';
import { getCurrentMonthKey } from '../utils/financePeriod';
import { formatCurrency } from '../utils/financeFormatters';

/** How long an unpaid bill past its due date keeps nagging (payment detection is by date, so not forever). */
const OVERDUE_ALERT_DAYS = 15;

/** Days without a newer imported entry before the statement counts as stale. */
const STALE_IMPORT_DAYS = 10;

function daysUntil(dateStr: string): number {
  // Both at local midnight: new Date('YYYY-MM-DD') is UTC midnight, 21h the day before here.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  const target = new Date(year, month - 1, day);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export const financeAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];

    const pendingCount = transactionService.listCurrentMonthReviewTransactions().length;
    if (pendingCount > 0) {
      alerts.push({
        id: 'finance-pending-review',
        moduleId: 'finance',
        severity: 'warning',
        title: `${pendingCount} transaç${pendingCount === 1 ? 'ão' : 'ões'} deste mês pra revisar`,
        description: 'Importadas automaticamente, aguardando classificação',
        actionLabel: 'Revisar',
        actionRoute: '/financeiro/revisao',
      });
    }

    // Data comes from statements the person imports: when the newest imported
    // entry is weeks old, every total on screen is quietly short.
    const lastImported = transactionService
      .listTransactions()
      .filter((t) => t.source !== 'manual' && t.source !== 'sample')
      .reduce<string | null>((latest, t) => (!latest || t.date > latest ? t.date : latest), null);
    if (lastImported) {
      const staleDays = -daysUntil(lastImported);
      if (staleDays >= STALE_IMPORT_DAYS) {
        const [, m, d] = lastImported.split('-');
        alerts.push({
          id: 'finance-stale-import',
          moduleId: 'finance',
          severity: 'info',
          title: `O último extrato importado vai até ${d}/${m}`,
          description: `Há ${staleDays} dias sem lançamentos novos — importe o extrato e a fatura recentes.`,
          actionLabel: 'Importar',
          actionRoute: '/financeiro/configurar/importar',
        });
      }
    }

    // With more than one card, the alert says which bill it is.
    const cards = invoiceService.listCreditCards();
    for (const invoice of invoiceService.listInvoices()) {
      // Nothing to pay is nothing to nag about — a new user's empty cards produce R$ 0,00 invoices.
      if (!invoice.dueDate || invoice.status === 'paid' || invoice.total <= 0) continue;
      const days = daysUntil(invoice.dueDate);
      if (days > 7 || days < -OVERDUE_ALERT_DAYS) continue;
      // An overdue unpaid bill is the most urgent case — it used to be skipped.
      const overdue = days < 0;
      const title = overdue
        ? `Fatura vencida há ${-days} dia${days !== -1 ? 's' : ''}`
        : `Fatura vence ${days === 0 ? 'hoje' : `em ${days} dia${days !== 1 ? 's' : ''}`}`;
      const cardName = cards.length > 1 ? cards.find((card) => card.id === invoice.cardId)?.name : undefined;
      alerts.push({
        id: `finance-invoice-${invoice.id}`,
        moduleId: 'finance',
        severity: days <= 3 ? 'critical' : 'warning',
        title: cardName ? `${title} · ${cardName}` : title,
        description: overdue ? `${formatCurrency(invoice.total)} — sem pagamento registrado` : formatCurrency(invoice.total),
        actionLabel: 'Ver fatura',
        actionRoute: cards.length > 1 ? `/financeiro/cartao?card=${invoice.cardId}` : '/financeiro/cartao',
      });
    }

    // ── Budget excedendo ─────────────────────────────────────────────────────
    const allTxs = transactionService.listTransactions();
    for (const budget of budgetService.listActiveBudgets()) {
      const usage = calculateBudgetUsage(budget, allTxs, getCurrentMonthKey());
      // Same threshold as the Orçamentos screen's "em atenção".
      if (usage.percentUsed > BUDGET_ATTENTION_PERCENT) {
        alerts.push({
          id: `finance-budget-${budget.id}`,
          moduleId: 'finance',
          severity: usage.status === 'exceeded' ? 'critical' : 'warning',
          title: `Orçamento "${budget.name}": ${Math.round(usage.percentUsed)}% usado`,
          description: usage.status !== 'exceeded' ? `Restam ${formatCurrency(usage.remaining)}` : 'Limite ultrapassado',
          actionLabel: 'Ver orçamentos',
          actionRoute: '/financeiro/configurar/orcamentos',
        });
      }
    }

    return alerts;
  },
};
