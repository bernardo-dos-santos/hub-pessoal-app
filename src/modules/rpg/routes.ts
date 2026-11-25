import { type ModuleRouteDefinition } from '../../core/module-registry/module-types';
import { RpgRoutesPage } from './pages/RpgRoutesPage';

export const rpgRoutes: ModuleRouteDefinition = {
  moduleId: 'rpg',
  path: 'rpg/*',
  element: RpgRoutesPage,
};
