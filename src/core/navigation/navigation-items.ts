import { type NavigationItem } from './navigation-types';
import { getModulesByStatus } from '../module-registry/modules';

/**
 * Todos os módulos ativos, sem curadoria manual de quem "cabe" na régua —
 * a barra de navegação rola/arrasta (ver AppLayout) em vez de cortar por
 * ordem ou esconder módulo atrás de um "Mais".
 */
export const navigationItems: NavigationItem[] = getModulesByStatus('active').map((module) => ({
  label: module.shortName,
  path: module.basePath,
}));
