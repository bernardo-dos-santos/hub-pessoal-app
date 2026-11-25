import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { GoalsRoutesPage } from './pages/GoalsRoutesPage';

export const goalsRoutes: ModuleRouteDefinition = {
  moduleId: 'goals',
  path: 'metas/*',
  element: GoalsRoutesPage,
};
