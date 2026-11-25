import { type ComponentType } from 'react';
import { type ModuleStatus } from './module-status';

export type ModuleId = 'finance' | 'study' | 'fitness' | 'college' | 'rpg' | 'goals' | 'planner' | 'projects';

export type ModuleCategory = 'life' | 'productivity' | 'health' | 'education' | 'creative' | 'finance';

export type ModuleDefinition = {
  id: ModuleId;
  name: string;
  shortName: string;
  /** Sigla de 2 letras — badge circular na Home, no overflow de navegação, etc. */
  sigla: string;
  description: string;
  basePath: string;
  status: ModuleStatus;
  accent: string;
  order: number;
  category: ModuleCategory;
  supportsSearch: boolean;
  supportsAiSummary: boolean;
  supportsBackup: boolean;
};

export type ModuleRouteDefinition = {
  /** Which module the route belongs to — a module the user didn't choose has no routes. */
  moduleId: ModuleId;
  path: string;
  element: ComponentType;
};
