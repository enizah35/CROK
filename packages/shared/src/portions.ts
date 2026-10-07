/**
 * Mise à l'échelle des portions (R-04), utilisée par la fiche recette et le mode cuisine.
 *
 * Règle : quantité × portions / servings_base, puis arrondi selon l'unité. Les ingrédients
 * `non_scalable` et ceux sans quantité (`au_gout`) ne changent pas.
 *
 * Arrondis par unité (choix documentés, R-04 ne fixe que g et pièces) :
 * - `g`, `ml` : à 5 près (R-04). En dessous de 10, à l'unité près, pour ne pas transformer
 *   3 g de levure en 0 ou en 5 g. Jamais 0 : au moins 1.
 * - `piece` : à la demi-unité (R-04), au moins ½.
 * - `cuillere_soupe`, `cuillere_cafe` : à la demi-cuillère (on ne mesure pas plus fin), au moins ½.
 * - `pincee` : à l'unité, au moins 1.
 * - `au_gout` : pas de quantité, rien à arrondir.
 */
import type { Ingredient, Unit } from './content';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 6;

/** Ramène un nombre de portions dans [1, 6], en entier (R-04). */
export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(servings)));
}

/** Arrondit `value` au multiple de `step` le plus proche (sans erreur de virgule flottante). */
function roundToStep(value: number, step: number): number {
  // Le petit epsilon fait tomber 12.4999999 (bruit flottant) sur le bon côté.
  return Math.round(value / step + 1e-9) * step;
}

/** Arrondi d'une quantité déjà mise à l'échelle, selon son unité (R-04). */
export function roundQuantity(value: number, unit: Unit): number {
  switch (unit) {
    case 'g':
    case 'ml':
      if (value < 10) return Math.max(1, roundToStep(value, 1));
      return roundToStep(value, 5);
    case 'piece':
    case 'cuillere_soupe':
    case 'cuillere_cafe':
      return Math.max(0.5, roundToStep(value, 0.5));
    case 'pincee':
      return Math.max(1, roundToStep(value, 1));
    case 'au_gout':
      return value;
  }
}

/** Une quantité pour `servings` portions, à partir de celle écrite pour `servingsBase` (R-04). */
export function scaleQuantity(
  quantity: number,
  unit: Unit,
  servingsBase: number,
  servings: number,
): number {
  if (!Number.isInteger(servingsBase) || servingsBase < MIN_SERVINGS) {
    throw new RangeError(`servingsBase invalide : ${servingsBase}`);
  }
  const target = clampServings(servings);
  if (target === servingsBase) return quantity;
  return roundQuantity((quantity * target) / servingsBase, unit);
}

/** Un ingrédient pour `servings` portions (R-04). `non_scalable` et `au_gout` : inchangés. */
export function scaleIngredient(
  ingredient: Ingredient,
  servingsBase: number,
  servings: number,
): Ingredient {
  if (ingredient.non_scalable || ingredient.quantity === undefined) return ingredient;
  return {
    ...ingredient,
    quantity: scaleQuantity(ingredient.quantity, ingredient.unit, servingsBase, servings),
  };
}

/**
 * Liste d'ingrédients pour `servings` portions (R-04). Fonction pure : la liste reçue n'est
 * pas modifiée. `servings` est ramené dans [1, 6].
 */
export function scaleIngredients(
  ingredients: readonly Ingredient[],
  servingsBase: number,
  servings: number,
): Ingredient[] {
  return ingredients.map((ingredient) => scaleIngredient(ingredient, servingsBase, servings));
}

/** Espace insécable : « 1 ½ » et « 200 g » ne sont jamais coupés en fin de ligne. */
const NBSP = '\u00a0';

const FRACTIONS: readonly [value: number, glyph: string][] = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
];

/** Nombre lisible : 2 → « 2 », 0.5 → « ½ », 1.5 → « 1 ½ », 0.3 → « 0,3 ». */
export function formatNumber(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const fraction = value - whole;
  if (Math.abs(fraction) < 1e-9) return String(whole);
  const glyph = FRACTIONS.find(([f]) => Math.abs(fraction - f) < 1e-9)?.[1];
  if (glyph) return whole === 0 ? glyph : `${whole}${NBSP}${glyph}`;
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

function unitLabel(unit: Exclude<Unit, 'au_gout'>, quantity: number): string {
  switch (unit) {
    case 'g':
      return 'g';
    case 'ml':
      return 'ml';
    case 'piece':
      return '';
    case 'cuillere_soupe':
      return 'c. à soupe';
    case 'cuillere_cafe':
      return 'c. à café';
    case 'pincee':
      return quantity >= 2 ? 'pincées' : 'pincée';
  }
}

/** Libellé affiché pour un ingrédient sans quantité (`au_gout`). */
export const TO_TASTE_LABEL = 'selon ton goût';

/**
 * Quantité lisible avec son unité : « 200 g », « 1 ½ », « ½ c. à soupe », « 2 pincées »,
 * « selon ton goût ». Les pièces n'ont pas d'unité : le nom de l'ingrédient suit.
 */
export function formatQuantity(quantity: number | undefined, unit: Unit): string {
  if (unit === 'au_gout' || quantity === undefined) return TO_TASTE_LABEL;
  const label = unitLabel(unit, quantity);
  const number = formatNumber(quantity);
  return label ? `${number}${NBSP}${label}` : number;
}
