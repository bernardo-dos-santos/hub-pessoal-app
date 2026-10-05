import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const financeModuleConfig: ModuleDefinition = {
  id: 'finance',
  name: 'Financeiro',
  shortName: 'Financeiro',
  sigla: 'FI',
  description: 'Base inicial para acompanhar a vida financeira pessoal sem regras profundas nesta fase.',
  basePath: '/financeiro',
  status: 'active',
  accent: 'bg-sky-600',
  order: 10,
  showInHome: true,
  category: 'finance',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: false,
};
