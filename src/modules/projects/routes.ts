import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { ProjectsRoutesPage } from './pages/ProjectsRoutesPage';

export const projectsRoutes: ModuleRouteDefinition = {
  path: 'projetos/*',
  element: ProjectsRoutesPage,
};
