import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const goalsModuleConfig: ModuleDefinition = {
  id: 'goals',
  name: 'Metas',
  shortName: 'Metas',
  sigla: 'ME',
  description: 'Acompanhamento de objetivos, marcos e ciclos pessoais.',
  basePath: '/metas',
  status: 'active',
  accent: 'bg-teal-600',
  order: 60,
  showInHome: true,
  category: 'productivity',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: false,
};
