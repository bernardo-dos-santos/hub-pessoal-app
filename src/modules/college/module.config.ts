import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const collegeModuleConfig: ModuleDefinition = {
  id: 'college',
  name: 'Faculdade',
  shortName: 'Faculdade',
  sigla: 'FA',
  description: 'Agenda acadêmica, disciplinas, tarefas, provas, notas e materiais do semestre.',
  basePath: '/faculdade',
  status: 'active',
  accent: 'bg-amber-600',
  order: 40,
  showInHome: true,
  category: 'education',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: true,
};
