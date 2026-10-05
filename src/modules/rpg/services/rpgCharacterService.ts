import { storageAdapter } from '../../../core/storage/storage.adapter';
import { generateId } from '../../../shared/utils/generateId';
import { defaultRpgCharacter, defaultRpgRulesProfile, rpgStorageKeys } from '../data/defaultRpgData';
import {
  type RpgAbility,
  type RpgAbilityInput,
  type RpgAbilityPreview,
  type RpgCharacter,
  type RpgCharacterInput,
  type RpgInventoryItem,
  type RpgInventoryItemInput,
  type RpgResourceId,
  type RpgRulesProfile,
} from '../types/rpg';
import { applyAbilityPreview, createAbilityPreview } from '../utils/rpgCalculations';

export type { RpgAbilityInput, RpgCharacterInput, RpgInventoryItemInput } from '../types/rpg';

let memoryCharacters: RpgCharacter[] | null = null;

function cloneCharacter(character: RpgCharacter): RpgCharacter {
  return JSON.parse(JSON.stringify(character)) as RpgCharacter;
}

/** Corrige dados de habilidades específicas trazidas de importações antigas —
 * não é migração de formato de armazenamento (essa é `readCharacters` abaixo). */
function migrateAbilityData(character: RpgCharacter): { changed: boolean; character: RpgCharacter } {
  let changed = false;
  const migratedCharacter: RpgCharacter = {
    ...character,
    abilities: character.abilities.map((ability) => {
      if (ability.id !== 'rascunho-do-medo') {
        return ability;
      }

      const costs = ability.costs.filter((cost) => !(cost.resourceId === 'fadiga' && cost.expression === '2'));
      const description = ability.description.includes('Custo do aliado')
        ? ability.description
        : `${ability.description} Custo do aliado: 2 de fadiga.`;

      if (costs.length !== ability.costs.length || description !== ability.description) {
        changed = true;
      }

      return {
        ...ability,
        costs,
        description,
      };
    }),
  };

  return { changed, character: migratedCharacter };
}

/** Garante que o personagem tem seu próprio `rulesProfile` — cobre registros
 * migrados antes desse campo existir. Nunca usa a fórmula do Bernardo como
 * padrão pra outro personagem: cada um começa com uma fórmula simples e neutra. */
function withRulesProfile(character: RpgCharacter): RpgCharacter {
  return character.rulesProfile ? character : { ...character, rulesProfile: createDefaultRulesProfile() };
}

/** Lê a lista de personagens, migrando o formato antigo (personagem único, chave
 * `rpg.activeCharacter` + regras globais em `rpg.rulesProfile`) pra dentro da
 * lista na primeira leitura — sem isso a ficha de verdade do Bernardo (armas,
 * habilidades homebrew, fórmula de defesa) se perderia. */
function readCharacters(): RpgCharacter[] {
  const stored = storageAdapter.getItem<RpgCharacter[]>(rpgStorageKeys.characters) ?? memoryCharacters;

  if (stored) {
    let changed = false;
    const migrated = stored.map((character) => {
      const migration = migrateAbilityData(withRulesProfile(character));
      if (migration.changed || !character.rulesProfile) changed = true;
      return migration.character;
    });

    if (changed) {
      writeCharacters(migrated);
    }

    return migrated;
  }

  const legacy = storageAdapter.getItem<RpgCharacter>(rpgStorageKeys.activeCharacter);
  if (legacy) {
    const legacyRulesProfile = storageAdapter.getItem<RpgRulesProfile>(rpgStorageKeys.rulesProfile) ?? defaultRpgRulesProfile;
    const migrated = migrateAbilityData({ ...legacy, rulesProfile: legacy.rulesProfile ?? legacyRulesProfile }).character;
    writeCharacters([migrated]);
    return [migrated];
  }

  const initial = [cloneCharacter(defaultRpgCharacter)];
  writeCharacters(initial);
  return initial;
}

function writeCharacters(characters: RpgCharacter[]): void {
  memoryCharacters = characters;
  storageAdapter.setItem(rpgStorageKeys.characters, characters);
}

function findCharacter(characterId: string): RpgCharacter {
  const character = readCharacters().find((current) => current.id === characterId);
  if (!character) {
    throw new Error('Personagem não encontrado.');
  }

  return character;
}

function persistCharacter(character: RpgCharacter): RpgCharacter {
  const updated = { ...character, updatedAt: new Date().toISOString() };
  const characters = readCharacters();
  writeCharacters(characters.map((current) => (current.id === updated.id ? updated : current)));
  return updated;
}

function getFrioAmargoLevelFromActiveTracker(trackerId: string) {
  const match = trackerId.match(/^em-uso-(\d)$/);
  return match?.[1] ?? null;
}

/** Fórmula neutra pra personagem novo — nunca a do Bernardo, que é exclusiva
 * dele. `calculateDefense` já cai pra `defesaBase + bonusDefesaTemporario`
 * quando não há regra melhor, então essa fórmula só torna isso explícito e
 * editável desde o início. */
function createDefaultRulesProfile(): RpgRulesProfile {
  return {
    id: generateId('rules'),
    name: 'Regras padrão',
    description: 'Fórmula simples de defesa — edite pra ajustar às regras da sua mesa.',
    defenseFormula: 'defesaBase + bonusDefesaTemporario',
    defenseFormulaNote: 'Defesa = base + bônus temporário. Edite a expressão conforme seu sistema.',
    allowedVariables: [],
  };
}

/** Personagem novo nasce com a mesma estrutura de atributos/recursos do Bernardo
 * (mesmas chaves), zerado, sem perícias/armas/habilidades/inventário, e com sua
 * própria fórmula de defesa neutra — nunca herda a fórmula do Bernardo. */
function createBlankCharacter(input: RpgCharacterInput): RpgCharacter {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Dê um nome ao personagem.');
  }

  const now = new Date().toISOString();

  return {
    id: generateId('character'),
    name,
    subtitle: input.subtitle?.trim() ?? '',
    campaign: input.campaign?.trim() ?? '',
    masterName: input.masterName?.trim() ?? '',
    portraitLabel: (input.portraitLabel?.trim() || name.charAt(0)).toUpperCase(),
    attributes: defaultRpgCharacter.attributes.map((attribute) => ({ ...attribute, value: 0 })),
    skills: [],
    resources: defaultRpgCharacter.resources.map((resource) => ({ ...resource, current: 0, max: 1, note: undefined })),
    defenseBase: 0,
    temporaryDefenseBonus: 0,
    weapons: [],
    abilities: [],
    inventory: [],
    activeEffects: [],
    storyNotes: '',
    rulesProfile: createDefaultRulesProfile(),
    createdAt: now,
    updatedAt: now,
  };
}

export const rpgCharacterService = {
  list(): RpgCharacter[] {
    return readCharacters();
  },

  get(characterId: string): RpgCharacter | null {
    return readCharacters().find((character) => character.id === characterId) ?? null;
  },

  create(input: RpgCharacterInput): RpgCharacter {
    const character = createBlankCharacter(input);
    writeCharacters([...readCharacters(), character]);
    return character;
  },

  remove(characterId: string): boolean {
    const characters = readCharacters();
    const next = characters.filter((character) => character.id !== characterId);
    if (next.length === characters.length) {
      return false;
    }

    writeCharacters(next);
    return true;
  },

  saveCharacter(character: RpgCharacter): RpgCharacter {
    return persistCharacter(character);
  },

  saveRulesProfile(characterId: string, profile: RpgRulesProfile): RpgCharacter {
    const character = findCharacter(characterId);
    return persistCharacter({ ...character, rulesProfile: profile });
  },

  updateResource(characterId: string, resourceId: RpgResourceId, current: number): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      resources: character.resources.map((resource) => (
        resource.id === resourceId
          ? { ...resource, current: Math.max(0, Math.min(resource.max, current)) }
          : resource
      )),
    });
  },

  updateResourceMax(characterId: string, resourceId: RpgResourceId, max: number): RpgCharacter {
    const character = findCharacter(characterId);
    const safeMax = Math.max(1, max);

    return persistCharacter({
      ...character,
      resources: character.resources.map((resource) => (
        resource.id === resourceId
          ? { ...resource, current: Math.min(resource.current, safeMax), max: safeMax }
          : resource
      )),
    });
  },

  createAbilityPreview(characterId: string, abilityId: string): RpgAbilityPreview | null {
    const character = findCharacter(characterId);
    const ability = character.abilities.find((item) => item.id === abilityId);

    return ability ? createAbilityPreview(character, ability) : null;
  },

  applyAbility(characterId: string, abilityId: string): RpgCharacter | null {
    const character = findCharacter(characterId);
    const ability = character.abilities.find((item) => item.id === abilityId);

    if (!ability) {
      return null;
    }

    return persistCharacter(applyAbilityPreview(character, createAbilityPreview(character, ability)));
  },

  updateAbility(characterId: string, ability: RpgAbility): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      abilities: character.abilities.map((item) => (item.id === ability.id ? ability : item)),
    });
  },

  createAbility(characterId: string, input: RpgAbilityInput): RpgCharacter {
    const title = input.title.trim();
    if (!title) {
      throw new Error('Dê um título à habilidade.');
    }

    const character = findCharacter(characterId);
    const now = new Date().toISOString();
    const ability: RpgAbility = {
      id: generateId('ability'),
      category: input.category,
      title,
      summary: input.summary?.trim() || undefined,
      description: input.description.trim(),
      formulas: [],
      costs: [],
      trackers: [],
      effects: [],
      createdAt: now,
      updatedAt: now,
    };

    return persistCharacter({ ...character, abilities: [...character.abilities, ability] });
  },

  deleteAbility(characterId: string, abilityId: string): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      abilities: character.abilities.filter((ability) => ability.id !== abilityId),
    });
  },

  addInventoryItem(characterId: string, input: RpgInventoryItemInput): RpgCharacter {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Dê um nome ao item.');
    }

    const character = findCharacter(characterId);
    const now = new Date().toISOString();
    const item: RpgInventoryItem = {
      id: generateId('item'),
      name,
      quantity: input.quantity,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    return persistCharacter({ ...character, inventory: [...character.inventory, item] });
  },

  updateInventoryItem(characterId: string, itemId: string, updates: Partial<RpgInventoryItemInput>): RpgCharacter {
    const character = findCharacter(characterId);
    const item = character.inventory.find((current) => current.id === itemId);
    if (!item) {
      return character;
    }

    const name = updates.name === undefined ? item.name : updates.name.trim();
    if (!name) {
      throw new Error('Dê um nome ao item.');
    }

    return persistCharacter({
      ...character,
      inventory: character.inventory.map((current) => (
        current.id === itemId
          ? {
            ...current,
            ...updates,
            name,
            notes: updates.notes === undefined ? current.notes : updates.notes.trim() || undefined,
            updatedAt: new Date().toISOString(),
          }
          : current
      )),
    });
  },

  deleteInventoryItem(characterId: string, itemId: string): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      inventory: character.inventory.filter((item) => item.id !== itemId),
    });
  },

  updateAbilityTracker(characterId: string, abilityId: string, trackerId: string, used: number): RpgCharacter {
    const character = findCharacter(characterId);
    const ability = character.abilities.find((item) => item.id === abilityId);
    const currentTracker = ability?.trackers.find((tracker) => tracker.id === trackerId);
    const safeUsed = Math.max(0, Math.min(currentTracker?.max ?? used, used));
    const frioAmargoLevel = abilityId === 'frio-amargo' ? getFrioAmargoLevelFromActiveTracker(trackerId) : null;
    const shouldConsumeFrioAmargoUse = Boolean(frioAmargoLevel && safeUsed > (currentTracker?.used ?? 0));
    const frioAmargoLevelTracker = ability?.trackers.find((tracker) => tracker.id === `nivel-${frioAmargoLevel}`);

    if (shouldConsumeFrioAmargoUse && (frioAmargoLevelTracker?.used ?? 0) >= (frioAmargoLevelTracker?.max ?? 0)) {
      return character;
    }

    return persistCharacter({
      ...character,
      abilities: character.abilities.map((ability) => {
        if (ability.id !== abilityId) {
          return ability;
        }

        return {
          ...ability,
          trackers: ability.trackers.map((tracker) => {
            if (shouldConsumeFrioAmargoUse && getFrioAmargoLevelFromActiveTracker(tracker.id) && tracker.id !== trackerId) {
              return { ...tracker, used: 0 };
            }

            if (tracker.id === trackerId) {
              return { ...tracker, used: safeUsed };
            }

            if (shouldConsumeFrioAmargoUse && tracker.id === `nivel-${frioAmargoLevel}`) {
              return { ...tracker, used: Math.min(tracker.max, tracker.used + 1) };
            }

            return tracker;
          }),
        };
      }),
    });
  },

  clearFrioAmargoActiveUses(characterId: string): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      abilities: character.abilities.map((ability) => (
        ability.id === 'frio-amargo'
          ? {
            ...ability,
            trackers: ability.trackers.map((tracker) => (
              getFrioAmargoLevelFromActiveTracker(tracker.id) ? { ...tracker, used: 0 } : tracker
            )),
          }
          : ability
      )),
    });
  },

  removeActiveEffect(characterId: string, effectId: string): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      activeEffects: character.activeEffects.filter((effect) => effect.id !== effectId),
    });
  },

  confirmReviewItem(characterId: string, kind: 'weapon' | 'ability', id: string): RpgCharacter {
    const character = findCharacter(characterId);

    return persistCharacter({
      ...character,
      abilities: character.abilities.map((ability) => (
        kind === 'ability' && ability.id === id
          ? {
            ...ability,
            formulas: ability.formulas.map((formula) => ({ ...formula, needsReview: false })),
            needsReview: false,
          }
          : ability
      )),
      weapons: character.weapons.map((weapon) => (
        kind === 'weapon' && weapon.id === id ? { ...weapon, needsReview: false } : weapon
      )),
    });
  },

  /** Restaura o módulo inteiro pro estado padrão (só o Bernardo) — usado em testes/debug. */
  resetLocalData(): RpgCharacter {
    memoryCharacters = null;
    storageAdapter.removeItem(rpgStorageKeys.characters);
    storageAdapter.removeItem(rpgStorageKeys.activeCharacter);
    storageAdapter.removeItem(rpgStorageKeys.rulesProfile);
    const character = cloneCharacter(defaultRpgCharacter);
    writeCharacters([character]);
    return character;
  },
};
