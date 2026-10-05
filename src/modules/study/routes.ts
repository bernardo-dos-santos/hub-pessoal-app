import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { StudyRoutesPage } from './pages/StudyRoutesPage';

export const studyRoutes: ModuleRouteDefinition = {
  path: 'estudos/*',
  element: StudyRoutesPage,
};
