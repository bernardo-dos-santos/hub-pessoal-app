import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader das Metas. Resumo (as ativas) e Encerradas (concluídas e
 * abandonadas). Sem Configurar: o módulo não tem preferências próprias. "Nova
 * meta" é uma ação, não uma tela de uso diário — fica como botão no Resumo.
 */
export function getGoalsTabs(): ModuleTab[] {
  return [
    { label: 'Resumo', to: '/metas', end: true },
    { label: 'Encerradas', to: '/metas/encerradas' },
  ];
}
