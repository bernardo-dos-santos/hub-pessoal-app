import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const projectsModuleConfig: ModuleDefinition = {
  id: 'projects',
  name: 'Projetos',
  shortName: 'Projetos',
  sigla: 'PR',
  description: 'Projetos pessoais com frentes paralelas, tarefas e cobrança de ritmo.',
  basePath: '/projetos',
  status: 'active',
  accent: 'bg-orange-600',
  order: 70,
  showInHome: true,
  category: 'productivity',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: true,
};
