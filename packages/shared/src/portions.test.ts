import { describe, expect, it } from 'vitest';

import type { Ingredient } from './content';
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  TO_TASTE_LABEL,
  clampServings,
  formatNumber,
  formatQuantity,
  roundQuantity,
  scaleIngredient,
  scaleIngredients,
  scaleQuantity,
} from './portions';

const NBSP = '\u00a0';

const ingredients: Ingredient[] = [
  { name: 'pâtes', quantity: 200, unit: 'g', category: 'feculents' },
  { name: 'lait de coco', quantity: 400, unit: 'ml' },
  { name: 'oignon', quantity: 1, unit: 'piece' },
  { name: 'huile', quantity: 1, unit: 'cuillere_soupe' },
  { name: 'curry', quantity: 2, unit: 'cuillere_cafe' },
  { name: 'muscade', quantity: 1, unit: 'pincee' },
  { name: 'feuille de laurier', quantity: 1, unit: 'piece', non_scalable: true },
  { name: 'sel', unit: 'au_gout' },
];

describe('clampServings (R-04 : 1 à 6 portions)', () => {
  it('garde les valeurs de 1 à 6', () => {
    for (let n = MIN_SERVINGS; n <= MAX_SERVINGS; n++) expect(clampServings(n)).toBe(n);
  });
  it('borne en dessous de 1 et au-dessus de 6', () => {
    expect(clampServings(0)).toBe(1);
    expect(clampServings(-3)).toBe(1);
    expect(clampServings(7)).toBe(6);
    expect(clampServings(100)).toBe(6);
  });
  it('arrondit à l’entier et résiste à NaN', () => {
    expect(clampServings(2.4)).toBe(2);
    expect(clampServings(Number.NaN)).toBe(1);
  });
});

describe('roundQuantity (R-04)', () => {
  it('g et ml : à 5 près', () => {
    expect(roundQuantity(133.33, 'g')).toBe(135);
    expect(roundQuantity(132.4, 'g')).toBe(130);
    expect(roundQuantity(12.5, 'ml')).toBe(15);
    expect(roundQuantity(10, 'g')).toBe(10);
  });
  it('g et ml sous 10 : à l’unité, jamais 0', () => {
    expect(roundQuantity(7.4, 'g')).toBe(7);
    expect(roundQuantity(2.5, 'ml')).toBe(3);
    expect(roundQuantity(0.2, 'g')).toBe(1);
  });
  it('pièces : à la demi-unité, au moins ½', () => {
    expect(roundQuantity(0.33, 'piece')).toBe(0.5);
    expect(roundQuantity(0.1, 'piece')).toBe(0.5);
    expect(roundQuantity(1.2, 'piece')).toBe(1);
    expect(roundQuantity(1.25, 'piece')).toBe(1.5);
    expect(roundQuantity(2.74, 'piece')).toBe(2.5);
    expect(roundQuantity(2.75, 'piece')).toBe(3);
  });
  it('cuillères : à la demi-cuillère, au moins ½', () => {
    expect(roundQuantity(0.25, 'cuillere_soupe')).toBe(0.5);
    expect(roundQuantity(1.66, 'cuillere_cafe')).toBe(1.5);
  });
  it('pincées : à l’unité, au moins 1', () => {
    expect(roundQuantity(0.25, 'pincee')).toBe(1);
    expect(roundQuantity(2.5, 'pincee')).toBe(3);
  });
});

describe('scaleQuantity', () => {
  it('quantité × portions / servings_base', () => {
    expect(scaleQuantity(200, 'g', 2, 4)).toBe(400);
    expect(scaleQuantity(200, 'g', 2, 3)).toBe(300);
    expect(scaleQuantity(400, 'ml', 3, 2)).toBe(265); // 266,67 → 265
  });
  it('mêmes portions que la base : quantité telle qu’écrite, sans arrondi', () => {
    expect(scaleQuantity(123, 'g', 2, 2)).toBe(123);
  });
  it('ramène les portions dans [1, 6]', () => {
    expect(scaleQuantity(100, 'g', 2, 10)).toBe(300);
    expect(scaleQuantity(100, 'g', 2, 0)).toBe(50);
  });
  it('refuse une base invalide', () => {
    expect(() => scaleQuantity(100, 'g', 0, 2)).toThrow(RangeError);
    expect(() => scaleQuantity(100, 'g', 1.5, 2)).toThrow(RangeError);
  });
});

describe('scaleIngredients (R-04)', () => {
  it('borne basse : 1 portion depuis une base de 4', () => {
    const scaled = scaleIngredients(ingredients, 4, 1);
    expect(scaled.map((i) => i.quantity)).toEqual([50, 100, 0.5, 0.5, 0.5, 1, 1, undefined]);
  });

  it('borne haute : 6 portions depuis une base de 4', () => {
    const scaled = scaleIngredients(ingredients, 4, 6);
    // 300 g, 600 ml, 1,5 oignon, 1,5 c. à soupe, 3 c. à café, 1,5 → 2 pincées, laurier inchangé.
    expect(scaled.map((i) => i.quantity)).toEqual([300, 600, 1.5, 1.5, 3, 2, 1, undefined]);
  });

  it('non_scalable : inchangé, quelle que soit la portion', () => {
    for (let n = 1; n <= 6; n++) {
      const laurier = scaleIngredients(ingredients, 4, n)[6];
      expect(laurier).toEqual(ingredients[6]);
    }
  });

  it('au_gout (quantité absente) : reste sans quantité', () => {
    const sel = scaleIngredient({ name: 'sel', unit: 'au_gout' }, 2, 6);
    expect(sel).toEqual({ name: 'sel', unit: 'au_gout' });
    expect('quantity' in sel).toBe(false);
  });

  it('conserve les autres champs et ne modifie pas la liste reçue', () => {
    const copy = structuredClone(ingredients);
    const scaled = scaleIngredients(ingredients, 4, 2);
    expect(ingredients).toEqual(copy);
    expect(scaled[0]).toEqual({ name: 'pâtes', quantity: 100, unit: 'g', category: 'feculents' });
  });

  it('base = portions demandées : liste identique', () => {
    expect(scaleIngredients(ingredients, 4, 4)).toEqual(ingredients);
  });
});

describe('formatNumber', () => {
  it('entiers et demis lisibles', () => {
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(0.5)).toBe('½');
    expect(formatNumber(1.5)).toBe(`1${NBSP}½`);
    expect(formatNumber(0.25)).toBe('¼');
    expect(formatNumber(2.75)).toBe(`2${NBSP}¾`);
  });
  it('autres décimales : virgule, 2 chiffres au plus', () => {
    expect(formatNumber(0.3)).toBe('0,3');
    expect(formatNumber(1.333)).toBe('1,33');
  });
});

describe('formatQuantity', () => {
  it('affiche l’unité adaptée', () => {
    expect(formatQuantity(200, 'g')).toBe(`200${NBSP}g`);
    expect(formatQuantity(150, 'ml')).toBe(`150${NBSP}ml`);
    expect(formatQuantity(1.5, 'piece')).toBe(`1${NBSP}½`);
    expect(formatQuantity(0.5, 'cuillere_soupe')).toBe(`½${NBSP}c. à soupe`);
    expect(formatQuantity(2, 'cuillere_cafe')).toBe(`2${NBSP}c. à café`);
    expect(formatQuantity(1, 'pincee')).toBe(`1${NBSP}pincée`);
    expect(formatQuantity(2, 'pincee')).toBe(`2${NBSP}pincées`);
  });
  it('au_gout ou quantité absente : « selon ton goût »', () => {
    expect(formatQuantity(undefined, 'au_gout')).toBe(TO_TASTE_LABEL);
    expect(formatQuantity(undefined, 'g')).toBe(TO_TASTE_LABEL);
  });
});
