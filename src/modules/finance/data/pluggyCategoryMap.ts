import { specialCategories } from './specialCategories';

/**
 * De-para entre a categoria que a Pluggy já devolve (em inglês) e as categorias
 * do Hub. Cobre só o que é inequívoco — categoria fora desta lista cai na
 * heurística de aliases do Hub, como antes.
 *
 * A precedência está em `mapPluggyTransactionToDraft`: regra manual do usuário e
 * alias do Hub vencem; a categoria da Pluggy só entra quando o Hub não teria
 * opinião própria e a transação cairia em "a revisar" sem categoria nenhuma.
 */
export const pluggyCategoryMap: Record<string, string> = {
  'Eating out': specialCategories.foodOut,
  'Food delivery': specialCategories.foodOut,
  Restaurants: specialCategories.foodOut,
  Groceries: specialCategories.market,
  Supermarkets: specialCategories.market,
  Transport: specialCategories.transport,
  'Public transportation': specialCategories.transport,
  'Taxi and ride-hailing': specialCategories.transport,
  Gasoline: specialCategories.transport,
  Health: specialCategories.health,
  'Healthcare services': specialCategories.health,
  Pharmacy: specialCategories.health,
  Education: specialCategories.education,
  Leisure: specialCategories.leisure,
  Entertainment: specialCategories.leisure,
  Rent: specialCategories.housing,
  Utilities: specialCategories.housing,
  Electricity: specialCategories.housing,
  'Water and sewage': specialCategories.housing,
  'Gym and fitness': specialCategories.gym,
  Pets: specialCategories.pet,
  'Pet supplies': specialCategories.pet,
};

export function mapPluggyCategory(pluggyCategory?: string | null): string | undefined {
  if (!pluggyCategory) return undefined;
  return pluggyCategoryMap[pluggyCategory];
}
