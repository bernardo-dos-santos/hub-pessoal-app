import { Navigate, Route, Routes } from 'react-router-dom';
import { ProjectsListPage } from './ProjectsListPage';
import { ProjectDetailPage } from './ProjectDetailPage';
import { ProjectDashboardPage } from './ProjectDashboardPage';
import { ProjectIssuesPage } from './ProjectIssuesPage';
import { ProjectDecisionsPage } from './ProjectDecisionsPage';
import { ProjectFilesPage } from './ProjectFilesPage';
import { ProjectFileViewerPage } from './ProjectFileViewerPage';
import { ProjectsActivityPage } from './ProjectsActivityPage';
import { ProjectExpansionsPage } from './ProjectExpansionsPage';

export function ProjectsRoutesPage() {
  return (
    <Routes>
      <Route index element={<ProjectsListPage />} />
      <Route path=":projectId" element={<ProjectDetailPage />} />
      <Route path=":projectId/melhorias" element={<ProjectIssuesPage />} />
      <Route path=":projectId/decisoes" element={<ProjectDecisionsPage />} />
      <Route path=":projectId/arquivos" element={<ProjectFilesPage />} />
      <Route path=":projectId/expansoes" element={<ProjectExpansionsPage />} />
      <Route path=":projectId/painel" element={<ProjectDashboardPage />} />
      <Route path=":projectId/arquivos/:fileId" element={<ProjectFileViewerPage />} />
      <Route path=":projectId/atividade" element={<ProjectsActivityPage />} />
      <Route path="*" element={<Navigate to="/projetos" replace />} />
    </Routes>
  );
}
