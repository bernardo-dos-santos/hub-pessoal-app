import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader do Treino — fonte única de todas as páginas do módulo
 * (substitui o antigo FitnessLayout, que fixava o título "Treino" em toda tela).
 *
 * Sem aba Configurar: o módulo não tem nenhuma preferência própria. O guia pede
 * Configurar por último quando há o que configurar, não uma aba vazia.
 */
export function getFitnessTabs(): ModuleTab[] {
  return [
    { label: 'Resumo', to: '/treino', end: true },
    { label: 'Registrar', to: '/treino/registrar' },
    { label: 'Histórico', to: '/treino/historico' },
    { label: 'Plano', to: '/treino/plano' },
  ];
}
