import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const fitnessModuleConfig: ModuleDefinition = {
  id: 'fitness',
  name: 'Treino',
  shortName: 'Treino',
  sigla: 'TR',
  description: 'Registro de treinos, status do TAF e acompanhamento para o concurso CBSC.',
  basePath: '/treino',
  status: 'active',
  accent: 'bg-emerald-600',
  order: 30,
  showInHome: true,
  category: 'health',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: false,
};
