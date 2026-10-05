import {
  type RpgAbility,
  type RpgAbilityPreview,
  type RpgCharacter,
  type RpgRulesProfile,
  type RpgResourceId,
} from '../types/rpg';
import { evaluateFormula, type RpgFormulaVariables } from './rpgFormula';

export function createRpgVariables(character: RpgCharacter): RpgFormulaVariables {
  const variables: RpgFormulaVariables = {
    bonusDefesaTemporario: character.temporaryDefenseBonus,
    defesaBase: character.defenseBase,
  };

  character.attributes.forEach((attribute) => {
    variables[attribute.key] = attribute.value;
  });

  character.skills.forEach((skill) => {
    variables[skill.id] = skill.value;
  });

  character.resources.forEach((resource) => {
    variables[resource.id] = resource.current;
    variables[`${resource.id}Max`] = resource.max;
  });

  character.abilities.forEach((ability) => {
    ability.trackers.forEach((tracker) => {
      const normalizedAbilityId = ability.id.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
      const normalizedTrackerId = tracker.id.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
      variables[`${normalizedAbilityId}_${normalizedTrackerId}`] = tracker.used;
    });
  });

  const frioAmargo = character.abilities.find((ability) => ability.id === 'frio-amargo');
  const frioTracker = (trackerId: string) => frioAmargo?.trackers.find((tracker) => tracker.id === trackerId)?.used ?? 0;
  variables.frioAmargoEmUso1 = frioTracker('em-uso-1') > 0 ? 1 : 0;
  variables.frioAmargoEmUso2 = frioTracker('em-uso-2') > 0 ? 1 : 0;
  variables.frioAmargoEmUso3 = frioTracker('em-uso-3') > 0 ? 1 : 0;
  variables.frioAmargoDtBonus = variables.frioAmargoEmUso3 > 0 ? 2 : 0;

  return variables;
}

export function calculateBernardoDefenseByLife(life: number, temporaryBonus = 0) {
  const baseDefense = 83;
  let lifeDefenseBonus = 0;

  if (life > 193) {
    lifeDefenseBonus = ((32 - 6) * (255 - life)) / (255 - 194) + 6;
  } else if (life > 102) {
    lifeDefenseBonus = ((152 - 32) * (193 - life)) / (193 - 103) + 32;
  } else {
    lifeDefenseBonus = ((267 - 152) * (102 - life)) / (102 - 1) + 152;
  }

  return Math.round(baseDefense + lifeDefenseBonus + temporaryBonus);
}

export function calculateDefense(character: RpgCharacter, rulesProfile?: RpgRulesProfile) {
  if (rulesProfile?.defenseFormula) {
    const result = evaluateFormula(rulesProfile.defenseFormula, createRpgVariables(character));

    if (result.ok) {
      return Math.round(result.value);
    }
  }

  const life = getResource(character, 'vida')?.current ?? 0;

  if (rulesProfile?.id === 'ordem-hibrido-bernardo') {
    return calculateBernardoDefenseByLife(life, character.temporaryDefenseBonus);
  }

  return character.defenseBase + character.temporaryDefenseBonus;
}

export function getResource(character: RpgCharacter, resourceId: RpgResourceId) {
  return character.resources.find((resource) => resource.id === resourceId) ?? null;
}

export function getReviewCount(character: RpgCharacter) {
  const weaponReviews = character.weapons.filter((weapon) => weapon.needsReview).length;
  const abilityReviews = character.abilities.filter((ability) => ability.needsReview || ability.formulas.some((formula) => formula.needsReview)).length;

  return weaponReviews + abilityReviews;
}

export function createAbilityPreview(character: RpgCharacter, ability: RpgAbility): RpgAbilityPreview {
  const variables = createRpgVariables(character);
  const warnings: string[] = [];

  const resourceChanges = ability.costs.map((cost) => {
    const resource = getResource(character, cost.resourceId);
    const result = evaluateFormula(cost.expression, variables);

    if (!resource) {
      warnings.push(`Recurso nao encontrado: ${cost.resourceId}`);
    }

    if (!result.ok) {
      warnings.push(`${cost.label ?? cost.resourceId}: ${result.error}`);
    }

    const current = resource?.current ?? 0;
    const value = Math.max(0, Math.ceil(result.value));

    return {
      cost: value,
      current,
      label: resource?.label ?? cost.resourceId,
      next: Math.max(0, current - value),
      resourceId: cost.resourceId,
    };
  });

  const trackers = ability.trackers.map((tracker) => {
    if (tracker.used >= tracker.max) {
      warnings.push(`${tracker.label} ja esta no limite.`);
    }

    return {
      id: tracker.id,
      label: tracker.label,
      max: tracker.max,
      nextUsed: Math.min(tracker.max, tracker.used + 1),
      used: tracker.used,
    };
  });

  return {
    ability,
    effects: ability.effects,
    resourceChanges,
    trackers,
    warnings,
  };
}

export function applyAbilityPreview(character: RpgCharacter, preview: RpgAbilityPreview): RpgCharacter {
  const now = new Date().toISOString();

  return {
    ...character,
    abilities: character.abilities.map((ability) => {
      if (ability.id !== preview.ability.id) {
        return ability;
      }

      return {
        ...ability,
        trackers: ability.trackers.map((tracker) => {
          const previewTracker = preview.trackers.find((item) => item.id === tracker.id);
          return previewTracker ? { ...tracker, used: previewTracker.nextUsed } : tracker;
        }),
        updatedAt: now,
      };
    }),
    activeEffects: [
      ...preview.effects.map((effect) => ({
        createdAt: now,
        description: effect.description,
        duration: effect.duration ?? 'Manual',
        id: `${preview.ability.id}-${effect.id}-${Date.now()}`,
        modifierExpression: effect.modifierExpression,
        modifierTarget: effect.modifierTarget,
        sourceAbilityId: preview.ability.id,
        title: effect.label,
        updatedAt: now,
      })),
      ...character.activeEffects,
    ],
    resources: character.resources.map((resource) => {
      const change = preview.resourceChanges.find((item) => item.resourceId === resource.id);
      return change ? { ...resource, current: change.next } : resource;
    }),
    updatedAt: now,
  };
}
