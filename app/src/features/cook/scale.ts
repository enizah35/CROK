/**
 * Recalcul des quantités selon les portions (R-04).
 *
 * Helper local temporaire : remplacé par scaleIngredients de @crok/shared à l'intégration.
 */
import type { Ingredient, Unit } from '@crok/shared';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 6;

export type ScaledIngredient = Ingredient & { scaledQuantity: number | undefined };

/** R-04 : g (et ml) à 5 près, pièces à la demi-unité, cuillères et pincées au quart. */
function roundForUnit(value: number, unit: Unit): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return value < 5 ? Math.max(1, Math.round(value)) : Math.round(value / 5) * 5;
    case 'piece':
      return Math.max(0.5, Math.round(value * 2) / 2);
    default:
      return Math.max(0.25, Math.round(value * 4) / 4);
  }
}

/** R-04 : quantité × portions / portions_base, sauf `non_scalable` et `au_gout`. */
export function scaleIngredients(
  ingredients: readonly Ingredient[],
  servingsBase: number,
  servings: number,
): ScaledIngredient[] {
  const factor = servings / servingsBase;
  return ingredients.map((ingredient) => {
    const { quantity } = ingredient;
    if (quantity === undefined || ingredient.non_scalable === true || factor === 1) {
      return { ...ingredient, scaledQuantity: quantity };
    }
    return { ...ingredient, scaledQuantity: roundForUnit(quantity * factor, ingredient.unit) };
  });
}

const UNIT_LABELS: Record<Unit, [singular: string, plural: string]> = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  piece: ['', ''],
  cuillere_soupe: ['c. à soupe', 'c. à soupe'],
  cuillere_cafe: ['c. à café', 'c. à café'],
  pincee: ['pincée', 'pincées'],
  au_gout: ['', ''],
};

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

/** « 200 g », « 1,5 », « 2 c. à soupe » ; chaîne vide pour « au goût ». */
export function formatQuantity(quantity: number | undefined, unit: Unit): string {
  if (quantity === undefined || unit === 'au_gout') return '';
  const [singular, plural] = UNIT_LABELS[unit];
  const label = quantity > 1 ? plural : singular;
  return label ? `${formatNumber(quantity)} ${label}` : formatNumber(quantity);
}
