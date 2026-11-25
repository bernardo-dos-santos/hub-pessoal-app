import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { PlannerRoutesPage } from './pages/PlannerRoutesPage';

export const plannerRoutes: ModuleRouteDefinition = {
  moduleId: 'planner',
  path: 'planner/*',
  element: PlannerRoutesPage,
};
