import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { CollegeRoutesPage } from './pages/CollegeRoutesPage';

export const collegeRoutes: ModuleRouteDefinition = {
  path: 'faculdade/*',
  element: CollegeRoutesPage,
};
