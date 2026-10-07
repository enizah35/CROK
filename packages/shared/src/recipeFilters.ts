/**
 * Filtres du catalogue de recettes (tâche 1.1) : temps, budget, équipement, tags.
 * La vision promet des recettes « filtrables par temps, budget et ustensiles ».
 *
 * Les filtres se combinent (ET) :
 * - temps : durée totale ≤ maximum choisi ;
 * - budget : coût par portion ≤ maximum choisi ;
 * - équipement : « ce que j'ai sous la main ». Une recette passe si tout l'équipement qu'elle
 *   demande fait partie de la sélection (sélection vide = pas de filtre) ;
 * - tags : la recette porte tous les tags choisis.
 */
import { EQUIPMENT, type Equipment } from './content';

/** Champs d'une recette utiles aux filtres (une ligne de la table `recipes` convient). */
export type FilterableRecipe = {
  total_min: number;
  cost_cents_per_serving: number;
  equipment: readonly string[];
  tags: readonly string[];
};

export type RecipeFilters = {
  /** Durée totale maximale en minutes ; null = pas de filtre. */
  maxTotalMin: number | null;
  /** Coût par portion maximal en centimes ; null = pas de filtre. */
  maxCostCents: number | null;
  /** Équipement disponible ; vide = pas de filtre. */
  equipment: readonly Equipment[];
  /** Tags exigés ; vide = pas de filtre. */
  tags: readonly string[];
};

export const EMPTY_FILTERS: RecipeFilters = {
  maxTotalMin: null,
  maxCostCents: null,
  equipment: [],
  tags: [],
};

/** Seuils proposés pour le temps (minutes). */
export const TIME_OPTIONS = [15, 30, 45] as const;
/** Seuils proposés pour le budget (centimes par portion ; objectif < 2,50 €). */
export const BUDGET_OPTIONS = [100, 150, 200] as const;

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  plaques: 'Plaques',
  four: 'Four',
  micro_ondes: 'Micro-ondes',
};

/** Libellés des tags connus ; les autres sont déduits du slug (« batch-cooking » → « Batch cooking »). */
const KNOWN_TAG_LABELS: Record<string, string> = {
  vegetarien: 'Végétarien',
  vegan: 'Vegan',
  express: 'Express',
  'batch-cooking': 'Batch cooking',
  'sans-gluten': 'Sans gluten',
  'sans-lactose': 'Sans lactose',
  epice: 'Épicé',
  dessert: 'Dessert',
};

export function tagLabel(tag: string): string {
  const known = KNOWN_TAG_LABELS[tag];
  if (known) return known;
  const words = tag.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isEquipment(value: string): value is Equipment {
  return (EQUIPMENT as readonly string[]).includes(value);
}

export function matchesFilters(recipe: FilterableRecipe, filters: RecipeFilters): boolean {
  if (filters.maxTotalMin !== null && recipe.total_min > filters.maxTotalMin) return false;
  if (filters.maxCostCents !== null && recipe.cost_cents_per_serving > filters.maxCostCents) {
    return false;
  }
  if (filters.equipment.length > 0) {
    const available: readonly string[] = filters.equipment;
    if (!recipe.equipment.every((item) => available.includes(item))) return false;
  }
  if (!filters.tags.every((tag) => recipe.tags.includes(tag))) return false;
  return true;
}

/** Recettes qui passent tous les filtres, dans l'ordre reçu. */
export function filterRecipes<T extends FilterableRecipe>(
  recipes: readonly T[],
  filters: RecipeFilters,
): T[] {
  return recipes.filter((recipe) => matchesFilters(recipe, filters));
}

export function countActiveFilters(filters: RecipeFilters): number {
  return (
    (filters.maxTotalMin === null ? 0 : 1) +
    (filters.maxCostCents === null ? 0 : 1) +
    filters.equipment.length +
    filters.tags.length
  );
}

/** Tags présents dans les recettes, sans doublon, triés par fréquence puis par ordre alphabétique. */
export function availableTags(recipes: readonly FilterableRecipe[]): string[] {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    for (const tag of recipe.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b, 'fr'))
    .map(([tag]) => tag);
}

/** Ajoute ou retire `value` d'une liste (sélection multiple). */
export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Choix unique désélectionnable : re-choisir la valeur courante la retire. */
export function toggleThreshold(current: number | null, value: number): number | null {
  return current === value ? null : value;
}

/** Prix lisible en euros : 120 → « 1,20 € ». */
export function formatEuros(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `${euros},${rest}\u00a0€`;
}

/** Durée lisible : 25 → « 25 min », 90 → « 1 h 30 », 60 → « 1 h ». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}\u00a0min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}\u00a0h` : `${hours}\u00a0h\u00a0${String(rest).padStart(2, '0')}`;
}
