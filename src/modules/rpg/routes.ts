import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { RpgRoutesPage } from './pages/RpgRoutesPage';

export const rpgRoutes: ModuleRouteDefinition = {
  path: 'rpg/*',
  element: RpgRoutesPage,
};
