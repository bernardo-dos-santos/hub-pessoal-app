import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { RedirectPreservingQuery } from '../../../shared/ui';
import { PlannerConfigurePage } from './PlannerConfigurePage';
import { PlannerTodayPage } from './PlannerTodayPage';
import { SessionDetailPage } from './SessionDetailPage';
import { WeeklyPlanPage } from './WeeklyPlanPage';

export function PlannerRoutesPage() {
  return (
    <Routes>
      {/* Abas — ver getPlannerTabs */}
      <Route index element={<PlannerTodayPage />} />
      <Route path="semana" element={<WeeklyPlanPage />} />
      <Route path="configurar" element={<PlannerConfigurePage />} />

      {/* Drill-down de uma sessão do plano */}
      <Route path="semana/sessao/:sessionId" element={<SessionDetailPage />} />

      {/* Endereços antigos (alertas, pushes e links salvos) */}
      <Route path="rotina" element={<RedirectPreservingQuery to="/planner/configurar" />} />
      <Route path="plano-semanal" element={<RedirectPreservingQuery to="/planner/semana" />} />
      <Route path="plano-semanal/sessao/:sessionId" element={<LegacySessionRedirect />} />

      <Route path="*" element={<Navigate to="/planner" replace />} />
    </Routes>
  );
}

function LegacySessionRedirect() {
  const { sessionId = '' } = useParams();
  return <RedirectPreservingQuery to={`/planner/semana/sessao/${sessionId}`} />;
}
