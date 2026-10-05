import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const studyModuleConfig: ModuleDefinition = {
  id: 'study',
  name: 'Estudos',
  shortName: 'Estudos',
  sigla: 'ES',
  description: 'Geração de questões, resumos, simulados e revisão com IA para faculdade e concurso.',
  basePath: '/estudos',
  status: 'active',
  accent: 'bg-indigo-600',
  order: 20,
  showInHome: true,
  category: 'education',
  supportsSearch: false,
  supportsAiSummary: true,
  supportsBackup: true,
};
