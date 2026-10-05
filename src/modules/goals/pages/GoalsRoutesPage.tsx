import { Navigate, Route, Routes } from 'react-router-dom';
import { GoalsDashboardPage } from './GoalsDashboardPage';
import { CreateGoalPage } from './CreateGoalPage';
import { GoalDetailPage } from './GoalDetailPage';

export function GoalsRoutesPage() {
  return (
    <Routes>
      <Route index element={<GoalsDashboardPage />} />
      <Route path="nova" element={<CreateGoalPage />} />
      <Route path=":id" element={<GoalDetailPage />} />
      <Route path="*" element={<Navigate to="/metas" replace />} />
    </Routes>
  );
}
