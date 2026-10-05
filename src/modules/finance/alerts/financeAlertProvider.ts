import { type AlertProvider, type HubAlert } from '../../../core/alerts/alert-types';
import { invoiceService } from '../services/invoiceService';
import { transactionService } from '../services/transactionService';
import { budgetService } from '../services/budgetService';
import { calculateBudgetUsage, filterTransactionsBySelectedMonth } from '../utils/financeCalculations';

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const financeAlertProvider: AlertProvider = {
  getAlerts(): HubAlert[] {
    const alerts: HubAlert[] = [];

    const pendingCount = transactionService.listRequiredReviewTransactions().length;
    if (pendingCount > 0) {
      alerts.push({
        id: 'finance-pending-review',
        moduleId: 'finance',
        severity: 'warning',
        title: `${pendingCount} transaç${pendingCount === 1 ? 'ão' : 'ões'} pra revisar`,
        description: 'Importadas automaticamente, aguardando classificação',
        actionLabel: 'Revisar',
        actionRoute: '/financeiro/revisao',
      });
    }

    for (const invoice of invoiceService.listInvoices()) {
      if (!invoice.dueDate || invoice.status === 'paid') continue;
      const days = daysUntil(invoice.dueDate);
      if (days < 0 || days > 7) continue;
      const daysLabel = days === 0 ? 'hoje' : `em ${days} dia${days !== 1 ? 's' : ''}`;
      alerts.push({
        id: `finance-invoice-${invoice.id}`,
        moduleId: 'finance',
        severity: days <= 3 ? 'critical' : 'warning',
        title: `Fatura vence ${daysLabel}`,
        description: `R$ ${invoice.total.toFixed(2).replace('.', ',')}`,
        actionLabel: 'Ver fatura',
        actionRoute: '/financeiro/cartoes',
      });
    }

    // ── Budget excedendo ─────────────────────────────────────────────────────
    const allTxs = transactionService.listTransactions();
    const thisMonthTxs = filterTransactionsBySelectedMonth(allTxs);
    for (const budget of budgetService.listActiveBudgets()) {
      const usage = calculateBudgetUsage(budget, thisMonthTxs);
      if (usage.percentUsed >= 80) {
        const remaining = usage.remaining.toFixed(2).replace('.', ',');
        alerts.push({
          id: `finance-budget-${budget.id}`,
          moduleId: 'finance',
          severity: usage.status === 'exceeded' ? 'critical' : 'warning',
          title: `Orçamento "${budget.name}": ${Math.round(usage.percentUsed)}% usado`,
          description: usage.status !== 'exceeded' ? `Restam R$ ${remaining}` : 'Limite ultrapassado',
          actionLabel: 'Ver orçamentos',
          actionRoute: '/financeiro/orcamentos',
        });
      }
    }

    return alerts;
  },
};
