import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const plannerModuleConfig: ModuleDefinition = {
  id: 'planner',
  name: 'Planner',
  shortName: 'Planner',
  sigla: 'PL',
  description: 'Planejamento semanal de estudos e rotina diária.',
  basePath: '/planner',
  status: 'active',
  accent: 'bg-indigo-600',
  order: 50,
  showInHome: true,
  category: 'productivity',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: false,
};
