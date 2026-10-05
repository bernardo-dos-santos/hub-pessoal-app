import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader do Financeiro — fonte única usada por todas as páginas do módulo.
 * É uma função (não uma constante) porque a aba Revisão carrega o indicador de pendências,
 * que varia por chamada — cada página calcula `transactionService.listRequiredReviewTransactions().length`
 * e passa aqui. A faixa rola/arrasta, então cabem todas numa lista só.
 */
export function getFinanceTabs(pendingReviewCount: number): ModuleTab[] {
  return [
    { label: 'Dashboard', to: '/financeiro', end: true },
    { label: 'Transações', to: '/financeiro/transacoes' },
    { label: 'Revisão', to: '/financeiro/revisao', badge: pendingReviewCount },
    { label: 'Cartões', to: '/financeiro/cartoes' },
    { label: 'Orçamentos', to: '/financeiro/orcamentos' },
    { label: 'Relatórios', to: '/financeiro/relatorios' },
    { label: 'Categorias', to: '/financeiro/categorias' },
    { label: 'Investimentos', to: '/financeiro/investimentos' },
  ];
}
