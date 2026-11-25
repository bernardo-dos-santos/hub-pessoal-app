import { type ModuleDefinition } from '../../core/module-registry/module-types';

export const rpgModuleConfig: ModuleDefinition = {
  id: 'rpg',
  name: 'RPG',
  shortName: 'RPG',
  sigla: 'RP',
  description: 'Uma ficha de personagem que evolui com os seus hábitos reais.',
  basePath: '/rpg',
  status: 'active',
  accent: 'bg-rose-600',
  order: 50,
  category: 'creative',
  supportsSearch: false,
  supportsAiSummary: false,
  supportsBackup: true,
};
