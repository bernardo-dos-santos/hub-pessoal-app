import { type BaseEntity } from '../../../shared/types/base-entity';

export type RpgTab = 'general' | 'attributes' | 'combat' | 'abilities' | 'inventory' | 'story' | 'review';

export type RpgAttributeKey = 'forca' | 'intelecto' | 'agilidade' | 'presenca' | 'vigor';

export type RpgResourceId = 'vida' | 'sanidade' | 'fadiga';

export type RpgAbilityCategory =
  | 'combat'
  | 'passive'
  | 'physical'
  | 'mental'
  | 'command'
  | 'uriel'
  | 'other';

export type RpgReviewStatus = 'pending' | 'confirmed';

export type RpgAttribute = {
  key: RpgAttributeKey;
  label: string;
  value: number;
};

export type RpgSkill = {
  id: string;
  name: string;
  category: string;
  value: number;
};

export type RpgResource = {
  id: RpgResourceId;
  label: string;
  current: number;
  max: number;
  color: string;
  note?: string;
};

export type RpgFormulaField = {
  id: string;
  label: string;
  expression: string;
  needsReview?: boolean;
};

export type RpgUsageTracker = {
  id: string;
  label: string;
  max: number;
  used: number;
  scope: string;
};

export type RpgAbilityCost = {
  resourceId: RpgResourceId;
  expression: string;
  label?: string;
};

export type RpgAbilityEffect = {
  id: string;
  label: string;
  description: string;
  duration?: string;
  modifierTarget?: string;
  modifierExpression?: string;
};

export type RpgAbility = BaseEntity & {
  category: RpgAbilityCategory;
  title: string;
  summary?: string;
  description: string;
  formulas: RpgFormulaField[];
  costs: RpgAbilityCost[];
  trackers: RpgUsageTracker[];
  effects: RpgAbilityEffect[];
  needsReview?: boolean;
};

export type RpgWeapon = BaseEntity & {
  name: string;
  range: string;
  damageFormula: string;
  criticalFormula: string;
  notes?: string;
  needsReview?: boolean;
};

export type RpgInventoryItem = BaseEntity & {
  name: string;
  quantity: number;
  notes?: string;
};

export type RpgActiveEffect = BaseEntity & {
  sourceAbilityId: string;
  title: string;
  description: string;
  duration: string;
  modifierTarget?: string;
  modifierExpression?: string;
};

export type RpgReviewItem = BaseEntity & {
  title: string;
  source: string;
  note: string;
  status: RpgReviewStatus;
};

export type RpgRulesProfile = {
  id: string;
  name: string;
  description: string;
  defenseFormulaNote: string;
  defenseFormula: string;
  allowedVariables: string[];
};

export type RpgCharacter = BaseEntity & {
  name: string;
  subtitle: string;
  campaign: string;
  masterName: string;
  portraitLabel: string;
  attributes: RpgAttribute[];
  skills: RpgSkill[];
  resources: RpgResource[];
  defenseBase: number;
  temporaryDefenseBonus: number;
  weapons: RpgWeapon[];
  abilities: RpgAbility[];
  inventory: RpgInventoryItem[];
  activeEffects: RpgActiveEffect[];
  storyNotes: string;
  /** Regras/fórmula de defesa — exclusiva de cada personagem, não compartilhada. */
  rulesProfile: RpgRulesProfile;
};

export type RpgAbilityPreview = {
  ability: RpgAbility;
  resourceChanges: Array<{
    resourceId: RpgResourceId;
    label: string;
    current: number;
    cost: number;
    next: number;
  }>;
  trackers: Array<{
    id: string;
    label: string;
    used: number;
    max: number;
    nextUsed: number;
  }>;
  effects: RpgAbilityEffect[];
  warnings: string[];
};

export type RpgTrackerUpdate = {
  abilityId: string;
  trackerId: string;
  used: number;
};

export type RpgCampaignStatus = 'active' | 'paused' | 'finished';

export type RpgCampaign = BaseEntity & {
  name: string;
  system?: string;
  gm?: string;
  status: RpgCampaignStatus;
  notes?: string;
};

/** Template pra pré-preencher o form de criação de item de inventário. */
export type RpgInventoryPreset = {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
};

/** Template pra pré-preencher o form de criação de habilidade — fórmulas/custos/
 * trackers/efeitos nascem vazios, o usuário edita via os fluxos já existentes. */
export type RpgAbilityPreset = {
  id: string;
  category: RpgAbilityCategory;
  title: string;
  summary?: string;
  description: string;
};

export type RpgInventoryItemInput = {
  name: string;
  quantity: number;
  notes?: string;
};

export type RpgAbilityInput = {
  category: RpgAbilityCategory;
  title: string;
  summary?: string;
  description: string;
};

export type RpgCharacterInput = {
  name: string;
  subtitle?: string;
  masterName?: string;
  campaign?: string;
  portraitLabel?: string;
};
