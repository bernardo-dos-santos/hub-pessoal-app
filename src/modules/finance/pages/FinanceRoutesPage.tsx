import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { BudgetsPage } from './BudgetsPage';
import { CardsPage } from './CardsPage';
import { CategoriesPage } from './CategoriesPage';
import { FinanceDashboardPage } from './FinanceDashboardPage';
import { ImportPage } from './ImportPage';
import { InvestmentsPlanningPage } from '../investments/pages/InvestmentsPlanningPage';
import { ReportsPage } from './ReportsPage';
import { ReviewPage } from './ReviewPage';
import { TransactionsPage } from './TransactionsPage';
import { MonthlySummaryPage } from './MonthlySummaryPage';
import { withReimbursementsParams } from '../utils/financePeriod';

// Rotas antigas de Faturas/Reembolsos/Análise IA — as páginas foram absorvidas
// por Cartões/Transações/Relatórios (redução de 12 para 8 abas). Continuam
// existindo como redirect, não como <Navigate> simples, pra preservar o
// ?month de links/alertas já emitidos antes desta mudança.
function RedirectPreservingQuery({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace />;
}

function RedirectReembolsos() {
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month');
  return <Navigate to={withReimbursementsParams(month ?? '')} replace />;
}

export function FinanceRoutesPage() {
  return (
    <Routes>
      <Route index element={<FinanceDashboardPage />} />
      <Route path="transacoes" element={<TransactionsPage />} />
      <Route path="revisao" element={<ReviewPage />} />
      <Route path="categorias" element={<CategoriesPage />} />
      <Route path="cartoes" element={<CardsPage />} />
      <Route path="faturas" element={<Navigate to="/financeiro/cartoes" replace />} />
      <Route path="orcamentos" element={<BudgetsPage />} />
      <Route path="reembolsos" element={<RedirectReembolsos />} />
      <Route path="investimentos" element={<InvestmentsPlanningPage />} />
      <Route path="importar" element={<ImportPage />} />
      <Route path="relatorios" element={<ReportsPage />} />
      <Route path="analise-ia" element={<RedirectPreservingQuery to="/financeiro/relatorios" />} />
      <Route path="resumo/:yyyyMM" element={<MonthlySummaryPage />} />
      <Route path="*" element={<Navigate to="/financeiro" replace />} />
    </Routes>
  );
}
