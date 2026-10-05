import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layout/AppLayout';
import { AiSettingsPage } from '../pages/AiSettingsPage';
import { AutomationsPage } from '../pages/AutomationsPage';
import { BackupPage } from '../pages/BackupPage';
import { ConcursoCbscPage } from '../pages/ConcursoCbscPage';
import { ConcursoAbinPage } from '../pages/ConcursoAbinPage';
import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';
import { financeRoutes } from '../../modules/finance/routes';
import { studyRoutes } from '../../modules/study/routes';
import { fitnessRoutes } from '../../modules/fitness/routes';
import { collegeRoutes } from '../../modules/college/routes';
import { rpgRoutes } from '../../modules/rpg/routes';
import { goalsRoutes } from '../../modules/goals/routes';
import { plannerRoutes } from '../../modules/planner/routes';
import { projectsRoutes } from '../../modules/projects/routes';

const moduleRoutes = [
  financeRoutes,
  studyRoutes,
  fitnessRoutes,
  collegeRoutes,
  rpgRoutes,
  goalsRoutes,
  plannerRoutes,
  projectsRoutes,
];

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="configuracoes/ia" element={<AiSettingsPage />} />
        <Route path="concurso" element={<ConcursoCbscPage />} />
        <Route path="abin" element={<ConcursoAbinPage />} />
        <Route path="backup" element={<BackupPage />} />
        <Route path="automacoes" element={<AutomationsPage />} />
        {moduleRoutes.map((route) => {
          const ModulePage = route.element;

          return <Route key={route.path} path={route.path} element={<ModulePage />} />;
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
