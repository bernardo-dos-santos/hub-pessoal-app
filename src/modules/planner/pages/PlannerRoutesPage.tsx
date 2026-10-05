import { Navigate, Route, Routes } from 'react-router-dom';
import { RoutinePage } from './RoutinePage';
import { SessionDetailPage } from './SessionDetailPage';
import { WeeklyPlanPage } from './WeeklyPlanPage';

export function PlannerRoutesPage() {
  return (
    <Routes>
      <Route index element={<WeeklyPlanPage />} />
      <Route path="rotina" element={<RoutinePage />} />
      <Route path="plano-semanal" element={<WeeklyPlanPage />} />
      <Route path="plano-semanal/sessao/:sessionId" element={<SessionDetailPage />} />
      <Route path="*" element={<Navigate to="/planner" replace />} />
    </Routes>
  );
}
