import { formatQuantity, scaleIngredients } from './scale';
import { RECIPE } from './testUtils';

describe('portions (R-04, helper temporaire)', () => {
  it('ne change rien aux portions de base', () => {
    const scaled = scaleIngredients(RECIPE.ingredients, 2, 2);
    expect(scaled.map((i) => i.scaledQuantity)).toEqual([200, 1, 1, undefined]);
  });

  it('met à l’échelle, arrondit selon l’unité et ignore non_scalable', () => {
    const scaled = scaleIngredients(RECIPE.ingredients, 2, 3);
    expect(scaled.map((i) => i.scaledQuantity)).toEqual([300, 1.5, 1, undefined]);
    const one = scaleIngredients([{ name: 'riz', quantity: 125, unit: 'g' }], 3, 1);
    expect(one[0]?.scaledQuantity).toBe(40); // 41,67 g → à 5 près
  });

  it('formate les quantités', () => {
    expect(formatQuantity(200, 'g')).toBe('200 g');
    expect(formatQuantity(1.5, 'piece')).toBe('1,5');
    expect(formatQuantity(2, 'pincee')).toBe('2 pincées');
    expect(formatQuantity(undefined, 'au_gout')).toBe('');
  });
});
