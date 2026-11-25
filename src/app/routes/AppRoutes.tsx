import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layout/AppLayout';
import { AiSettingsPage } from '../pages/AiSettingsPage';
import { AutomationsPage } from '../pages/AutomationsPage';
import { BackupPage } from '../pages/BackupPage';
import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';
import { ModulesPage } from '../pages/ModulesPage';
import { ConnectionsPage } from '../pages/ConnectionsPage';
import { AdminPage } from '../pages/AdminPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { canSeeAdmin, getDeniedReason, isModuleBlocked, isModuleEnabled, useSession } from '../../core/session/session';
import { MaintenancePage } from '../pages/MaintenancePage';
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
  const session = useSession();
  const denied = getDeniedReason();

  if (denied) return <AccessDeniedPage reason={denied} />;
  if (!session.onboardedAt) return <OnboardingPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="configuracoes/ia" element={<AiSettingsPage />} />
        <Route path="configuracoes/modulos" element={<ModulesPage />} />
        <Route path="configuracoes/conexoes" element={<ConnectionsPage />} />
        <Route path="backup" element={<BackupPage />} />
        {session.isOwner && <Route path="automacoes" element={<AutomationsPage />} />}
        {canSeeAdmin(session) && <Route path="admin" element={<AdminPage />} />}
        {moduleRoutes.filter((route) => isModuleEnabled(route.moduleId, session)).map((route) => {
          const ModulePage = route.element;
          const element = isModuleBlocked(route.moduleId, session) ? <MaintenancePage moduleId={route.moduleId} /> : <ModulePage />;

          return <Route key={route.path} path={route.path} element={element} />;
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
