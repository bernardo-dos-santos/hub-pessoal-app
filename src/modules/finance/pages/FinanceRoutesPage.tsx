import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RedirectPreservingQuery } from '../../../shared/ui';
import { BudgetsPage } from './BudgetsPage';
import { CardsPage } from './CardsPage';
import { CategoriesPage } from './CategoriesPage';
import { ConfigurePage } from './ConfigurePage';
import { FinanceDashboardPage } from './FinanceDashboardPage';
import { ImportPage } from './ImportPage';
import { InvestmentsPlanningPage } from '../investments/pages/InvestmentsPlanningPage';
import { ReportsPage } from './ReportsPage';
import { ReviewPage } from './ReviewPage';
import { TransactionsPage } from './TransactionsPage';
import { MonthlySummaryPage } from './MonthlySummaryPage';

// Old addresses (tabs that were merged or moved under Gastos/Configurar) stay as
// redirects that keep the query string — links in pushes, alerts and bookmarks
// carry ?month / ?category / ?view.
function RedirectReembolsos() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('view', 'reembolsos');
  return <Navigate to={{ pathname: '/financeiro/gastos', search: `?${params.toString()}` }} replace />;
}

export function FinanceRoutesPage() {
  return (
    <Routes>
      <Route index element={<FinanceDashboardPage />} />
      <Route path="gastos" element={<TransactionsPage />} />
      <Route path="gastos/relatorio" element={<ReportsPage />} />
      <Route path="cartao" element={<CardsPage />} />
      <Route path="revisao" element={<ReviewPage />} />
      <Route path="investimentos" element={<InvestmentsPlanningPage />} />
      <Route path="configurar" element={<ConfigurePage />} />
      <Route path="configurar/orcamentos" element={<BudgetsPage />} />
      <Route path="configurar/categorias" element={<CategoriesPage />} />
      <Route path="configurar/importar" element={<ImportPage />} />
      <Route path="resumo/:yyyyMM" element={<MonthlySummaryPage />} />

      <Route path="transacoes" element={<RedirectPreservingQuery to="/financeiro/gastos" />} />
      <Route path="reembolsos" element={<RedirectReembolsos />} />
      <Route path="relatorios" element={<RedirectPreservingQuery to="/financeiro/gastos/relatorio" />} />
      <Route path="analise-ia" element={<RedirectPreservingQuery to="/financeiro/gastos/relatorio" />} />
      <Route path="cartoes" element={<RedirectPreservingQuery to="/financeiro/cartao" />} />
      <Route path="faturas" element={<RedirectPreservingQuery to="/financeiro/cartao" />} />
      <Route path="orcamentos" element={<RedirectPreservingQuery to="/financeiro/configurar/orcamentos" />} />
      <Route path="categorias" element={<RedirectPreservingQuery to="/financeiro/configurar/categorias" />} />
      <Route path="importar" element={<RedirectPreservingQuery to="/financeiro/configurar/importar" />} />
      <Route path="*" element={<Navigate to="/financeiro" replace />} />
    </Routes>
  );
}
