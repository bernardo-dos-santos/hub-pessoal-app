import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader do Planejador — fonte única de todas as páginas.
 *
 * Hoje é o resumo (a agenda do dia, marcável); Semana é a grade do plano, onde
 * ele é gerado; Configurar (último) reúne a rotina e a geração automática — os
 * dados que alimentam o plano, que antes dividiam a tela com ele.
 */
export function getPlannerTabs(): ModuleTab[] {
  return [
    { label: 'Hoje', to: '/planner', end: true },
    { label: 'Semana', to: '/planner/semana' },
    { label: 'Configurar', to: '/planner/configurar' },
  ];
}
