import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { StudyRoutesPage } from './pages/StudyRoutesPage';

export const studyRoutes: ModuleRouteDefinition = {
  moduleId: 'study',
  path: 'estudos/*',
  element: StudyRoutesPage,
};
