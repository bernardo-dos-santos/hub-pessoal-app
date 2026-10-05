import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { FinanceRoutesPage } from './pages/FinanceRoutesPage';

export const financeRoutes: ModuleRouteDefinition = {
  path: 'financeiro/*',
  element: FinanceRoutesPage,
};
