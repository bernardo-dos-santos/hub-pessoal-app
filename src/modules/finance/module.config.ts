import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const financeModuleConfig: ModuleDefinition = {
  id: 'finance',
  name: 'Financeiro',
  shortName: 'Financeiro',
  sigla: 'FI',
  description: 'Contas, cartões, orçamento do mês, metas de investimento e importação do banco.',
  basePath: '/financeiro',
  status: 'active',
  accent: 'bg-sky-600',
  order: 10,
  category: 'finance',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: false,
};
