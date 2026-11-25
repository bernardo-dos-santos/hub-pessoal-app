import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const fitnessModuleConfig: ModuleDefinition = {
  id: 'fitness',
  name: 'Treino',
  shortName: 'Treino',
  sigla: 'TR',
  description: 'Registro de treinos, histórico e plano de treino por IA.',
  basePath: '/treino',
  status: 'active',
  accent: 'bg-emerald-600',
  order: 30,
  category: 'health',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: false,
};
