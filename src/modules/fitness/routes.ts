import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { FitnessRoutesPage } from './pages/FitnessRoutesPage';

export const fitnessRoutes: ModuleRouteDefinition = {
  moduleId: 'fitness',
  path: 'treino/*',
  element: FitnessRoutesPage,
};
