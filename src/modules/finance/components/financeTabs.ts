import { type ModuleTab } from '../../../shared/ui';

/**
 * Abas do ModuleHeader do Financeiro — fonte única usada por todas as páginas do módulo.
 * É uma função (não uma constante) porque a aba Revisar carrega o indicador de pendências,
 * que varia por chamada — cada página calcula `transactionService.listCurrentMonthReviewTransactions().length`
 * e passa aqui.
 *
 * Formato dos módulos (o mesmo em todos): Resumo primeiro, as telas
 * de uso no meio, Configurar por último. Telas que são ajuste (orçamentos,
 * categorias, importar) moram dentro de Configurar; o relatório dentro de Gastos —
 * por isso as rotas delas são aninhadas e a aba-mãe continua marcada.
 */
export function getFinanceTabs(pendingReviewCount: number): ModuleTab[] {
  return [
    { label: 'Resumo', to: '/financeiro', end: true },
    { label: 'Gastos', to: '/financeiro/gastos' },
    { label: 'Cartão', to: '/financeiro/cartao' },
    { label: 'Revisar', to: '/financeiro/revisao', badge: pendingReviewCount },
    { label: 'Investimentos', to: '/financeiro/investimentos' },
    { label: 'Configurar', to: '/financeiro/configurar' },
  ];
}
