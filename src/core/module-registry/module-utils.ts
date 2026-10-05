import { type ModuleDefinition } from './module-types';
import { type ModuleStatus } from './module-status';

export function filterModulesByStatus(modules: ModuleDefinition[], status: ModuleStatus) {
  return modules.filter((module) => module.status === status);
}

export function sortModulesByOrder(modules: ModuleDefinition[]) {
  return [...modules].sort((current, next) => current.order - next.order);
}

export function filterHomeModules(modules: ModuleDefinition[]) {
  return sortModulesByOrder(modules.filter((module) => module.showInHome));
}

export function findModuleByPath(modules: ModuleDefinition[], path: string) {
  return modules.find((module) => module.basePath === path);
}
