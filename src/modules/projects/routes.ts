import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { ProjectsRoutesPage } from './pages/ProjectsRoutesPage';

export const projectsRoutes: ModuleRouteDefinition = {
  moduleId: 'projects',
  path: 'projetos/*',
  element: ProjectsRoutesPage,
};
