import { Navigate, Route, Routes } from 'react-router-dom';
import { FitnessDashboardPage } from './FitnessDashboardPage';
import { FitnessPlannedPage } from './FitnessPlannedPage';
import { LogWorkoutPage } from './LogWorkoutPage';
import { WorkoutLogPage } from './WorkoutLogPage';

export function FitnessRoutesPage() {
  return (
    <Routes>
      <Route index element={<FitnessDashboardPage />} />
      <Route path="registrar" element={<LogWorkoutPage />} />
      <Route path="historico" element={<WorkoutLogPage />} />
      <Route path="plano" element={<FitnessPlannedPage />} />
      <Route path="*" element={<Navigate to="/treino" replace />} />
    </Routes>
  );
}
