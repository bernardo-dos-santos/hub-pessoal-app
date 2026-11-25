import { useState } from 'react';
import { Card, ListRow, ModuleHeader } from '../../../shared/ui';
import { CardSettingsCard } from '../components/CardSettings';
import { FinancialMonthCard } from '../components/FinancialMonthCard';
import { getFinanceTabs } from '../components/financeTabs';
import { budgetService } from '../services/budgetService';
import { categoryRuleService } from '../services/categoryRuleService';
import { categoryService } from '../services/categoryService';
import { transactionService } from '../services/transactionService';

function Meta({ children }: { children: string }) {
  return <p className="mt-0.5 text-xs" style={{ color: 'var(--hub-subtle)' }}>{children}</p>;
}

/**
 * Configurar — every setting of the module in one place, so the screens people
 * use day to day (Resumo, Gastos, Cartão) carry no setup forms. Inline when it's
 * one small form, a row to its own screen when it's a whole editor.
 */
export function ConfigurePage() {
  const [, forceUpdate] = useState(0);
  const pendingReviewCount = transactionService.listCurrentMonthReviewTransactions().length;
  const budgets = budgetService.listActiveBudgets().length;
  const categories = categoryService.getAvailableCategories().length;
  const rules = categoryRuleService.listCategoryRules().filter((rule) => rule.isActive).length;

  return (
    <div>
      <ModuleHeader eyebrow="Módulo · Financeiro" title="Configurar" tabs={getFinanceTabs(pendingReviewCount)} />

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <FinancialMonthCard onChange={() => forceUpdate((n) => n + 1)} />

          <Card>
            <ListRow
              to="/financeiro/configurar/orcamentos"
              label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>Orçamentos</p><Meta>{budgets > 0 ? `${budgets} limite${budgets === 1 ? '' : 's'} por categoria` : 'Nenhum limite ainda'}</Meta></>}
              value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
            />
            <ListRow
              to="/financeiro/configurar/categorias"
              label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>Categorias e regras</p><Meta>{`${categories} categorias · ${rules} regra${rules === 1 ? '' : 's'} automática${rules === 1 ? '' : 's'}`}</Meta></>}
              value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
            />
            <ListRow
              to="/financeiro/configurar/importar"
              label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>Importar extrato</p><Meta>CSV do extrato ou da fatura</Meta></>}
              value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
            />
            <ListRow
              to="/configuracoes/conexoes"
              last
              label={<><p className="text-sm" style={{ color: 'var(--hub-text)' }}>De onde vêm os dados</p><Meta>Extrato e avisos do banco por e-mail</Meta></>}
              value={<span style={{ color: 'var(--hub-subtle)' }}>→</span>}
            />
          </Card>
        </div>

        <div className="min-w-0">
          <CardSettingsCard onSaved={() => forceUpdate((n) => n + 1)} />
        </div>
      </div>
    </div>
  );
}
