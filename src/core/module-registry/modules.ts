import { collegeModuleConfig } from '../../modules/college/module.config';
import { financeModuleConfig } from '../../modules/finance/module.config';
import { fitnessModuleConfig } from '../../modules/fitness/module.config';
import { goalsModuleConfig } from '../../modules/goals/module.config';
import { plannerModuleConfig } from '../../modules/planner/module.config';
import { projectsModuleConfig } from '../../modules/projects/module.config';
import { rpgModuleConfig } from '../../modules/rpg/module.config';
import { studyModuleConfig } from '../../modules/study/module.config';
import { type ModuleStatus } from './module-status';
import { type ModuleDefinition } from './module-types';
import { filterHomeModules, filterModulesByStatus, sortModulesByOrder } from './module-utils';

export const modules: ModuleDefinition[] = sortModulesByOrder([
  financeModuleConfig,
  studyModuleConfig,
  fitnessModuleConfig,
  collegeModuleConfig,
  rpgModuleConfig,
  goalsModuleConfig,
  plannerModuleConfig,
  projectsModuleConfig,
]);

export function getModulesByStatus(status: ModuleStatus) {
  return sortModulesByOrder(filterModulesByStatus(modules, status));
}

export function getHomeModules() {
  return filterHomeModules(modules);
}
