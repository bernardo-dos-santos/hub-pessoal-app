import { type RpgAbilityCategory, type RpgTab } from '../../types/rpg';

export const rpgCharacterTabs: Array<{ id: RpgTab; label: string }> = [
  { id: 'general', label: 'Geral' },
  { id: 'attributes', label: 'Atributos' },
  { id: 'combat', label: 'Combate' },
  { id: 'abilities', label: 'Habilidades' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'story', label: 'Historia' },
  { id: 'review', label: 'Revisao' },
];

export const rpgAbilityCategoryLabels: Record<RpgAbilityCategory, string> = {
  combat: 'Habilidades de combate',
  command: 'Habilidades de comando',
  mental: 'Habilidades mentais',
  other: 'Outras habilidades',
  passive: 'Habilidades passivas',
  physical: 'Habilidades fisicas',
  uriel: 'Bencao de Uriel',
};

export function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}
