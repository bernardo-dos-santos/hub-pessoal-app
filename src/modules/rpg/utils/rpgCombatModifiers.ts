import { type RpgAbility, type RpgCharacter, type RpgFormulaField } from '../types/rpg';

const frioAmargoTerms = [
  'frioAmargoEmUso1 * (1d10 + 2)',
  'frioAmargoEmUso2 * (2d10 + 2)',
  'frioAmargoEmUso3 * (3d10 + 2)',
];

const damageKeywords = ['dano', 'normal', 'critico', 'critico', 'ataque', 'magnetic', 'magnetico'];

function stripLegacyFrioAmargoTerms(expression: string) {
  return expression
    .replace(/\s*\+\s*\(0\s*\*\s*\(1d10\s*\+\s*2\)\)/gi, '')
    .replace(/\s*\+\s*\(0\s*\*\s*\(2d10\s*\+\s*2\)\)/gi, '')
    .replace(/\s*\+\s*\(0\s*\*\s*\(3d10\s*\+\s*2\)\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function getFrioAmargoActiveLevels(character: RpgCharacter) {
  const frioAmargo = character.abilities.find((ability) => ability.id === 'frio-amargo');

  return [1, 2, 3].map((level) => {
    const tracker = frioAmargo?.trackers.find((item) => item.id === `em-uso-${level}`);
    const levelTracker = frioAmargo?.trackers.find((item) => item.id === `nivel-${level}`);
    return {
      active: (tracker?.used ?? 0) > 0,
      exhausted: (levelTracker?.used ?? 0) >= (levelTracker?.max ?? 0),
      level,
      max: levelTracker?.max ?? 0,
      trackerId: `em-uso-${level}`,
      used: levelTracker?.used ?? 0,
    };
  });
}

export function isFrioAmargoActiveTrackerBlocked(ability: RpgAbility, trackerId: string) {
  if (ability.id !== 'frio-amargo') {
    return false;
  }

  const match = trackerId.match(/^em-uso-(\d)$/);
  if (!match) {
    return false;
  }

  const currentTracker = ability.trackers.find((tracker) => tracker.id === trackerId);
  const levelTracker = ability.trackers.find((tracker) => tracker.id === `nivel-${match[1]}`);

  return (currentTracker?.used ?? 0) === 0 && (levelTracker?.used ?? 0) >= (levelTracker?.max ?? 0);
}

export function shouldApplyRpgDamageModifiers(ability: RpgAbility | null, formula: RpgFormulaField | null) {
  if (ability?.id === 'frio-amargo') {
    return false;
  }

  if (!formula) {
    return true;
  }

  const searchableText = `${formula.id} ${formula.label}`.toLowerCase();
  return damageKeywords.some((keyword) => searchableText.includes(keyword));
}

export function applyRpgDamageModifiers(
  expression: string,
  character: RpgCharacter,
  context: { ability?: RpgAbility | null; formula?: RpgFormulaField | null } = {},
) {
  const baseExpression = stripLegacyFrioAmargoTerms(expression);

  if (baseExpression.includes('frioAmargoEmUso')) {
    return baseExpression;
  }

  if (!shouldApplyRpgDamageModifiers(context.ability ?? null, context.formula ?? null)) {
    return baseExpression;
  }

  const hasActiveFrioAmargo = getFrioAmargoActiveLevels(character).some((item) => item.active);
  if (!hasActiveFrioAmargo) {
    return baseExpression;
  }

  return `${baseExpression} + ${frioAmargoTerms.map((term) => `(${term})`).join(' + ')}`;
}
