import { type NavigationItem } from './navigation-types';
import { getModulesByStatus } from '../module-registry/modules';
import { isModuleEnabled, type Session } from '../session/session';

/**
 * Todos os módulos ativos que o usuário escolheu, sem curadoria manual de quem "cabe" na régua —
 * a barra de navegação rola/arrasta (ver AppLayout) em vez de cortar por
 * ordem ou esconder módulo atrás de um "Mais".
 */
export function getNavigationItems(session: Session): NavigationItem[] {
  return getModulesByStatus('active')
    .filter((module) => isModuleEnabled(module.id, session))
    .map((module) => ({ label: module.shortName, path: module.basePath }));
}
