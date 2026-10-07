import { InvalidRecipeError, parseRecipeDetail } from './api';
import { dahl } from './fixtures';

describe('parseRecipeDetail', () => {
  it('valide les colonnes jsonb ingredients et steps', () => {
    const row = { ...dahl, ingredients: dahl.ingredients as unknown, steps: dahl.steps as unknown };
    expect(parseRecipeDetail(row)).toEqual(dahl);
  });

  it('refuse des ingrédients mal formés', () => {
    const row = { ...dahl, ingredients: [{ name: 'x', unit: 'kg' }] as unknown };
    expect(() => parseRecipeDetail(row)).toThrow(InvalidRecipeError);
  });

  it('refuse des étapes absentes', () => {
    const row = { ...dahl, steps: null as unknown };
    expect(() => parseRecipeDetail(row)).toThrow(InvalidRecipeError);
  });
});
