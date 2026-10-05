import { Navigate, Route, Routes } from 'react-router-dom';
import { FitnessLayout } from '../components/FitnessLayout';
import { FitnessDashboardPage } from './FitnessDashboardPage';
import { FitnessPlannedPage } from './FitnessPlannedPage';
import { LogWorkoutPage } from './LogWorkoutPage';
import { TafRequirementsPage } from './TafRequirementsPage';
import { WorkoutLogPage } from './WorkoutLogPage';

export function FitnessRoutesPage() {
  return (
    <FitnessLayout>
      <Routes>
        <Route index element={<FitnessDashboardPage />} />
        <Route path="registrar" element={<LogWorkoutPage />} />
        <Route path="historico" element={<WorkoutLogPage />} />
        <Route path="taf" element={<TafRequirementsPage />} />
        <Route path="plano" element={<FitnessPlannedPage />} />
        <Route path="*" element={<Navigate to="/treino" replace />} />
      </Routes>
    </FitnessLayout>
  );
}
