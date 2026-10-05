import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const rpgModuleConfig: ModuleDefinition = {
  id: 'rpg',
  name: 'RPG',
  shortName: 'RPG',
  sigla: 'RP',
  description: 'Ficha automatica mobile-first para o personagem Bernardo.',
  basePath: '/rpg',
  status: 'active',
  accent: 'bg-rose-600',
  order: 50,
  showInHome: true,
  category: 'creative',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: true,
};
