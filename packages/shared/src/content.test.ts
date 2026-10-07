import { describe, expect, it } from 'vitest';

import { challengeSchema, contentJsonSchema, recipeSchema } from './content';
import type { RecipeInput } from './content';

const validRecipe = (): RecipeInput => ({
  slug: 'pates-one-pot',
  title: 'Pâtes one-pot',
  servings_base: 2,
  total_min: 20,
  active_min: 8,
  cost_cents_per_serving: 95,
  equipment: ['plaques'],
  ingredients: [
    { name: 'spaghetti', quantity: 200, unit: 'g', category: 'feculents' },
    { name: 'feuille de laurier', quantity: 1, unit: 'piece', non_scalable: true },
    { name: 'sel', unit: 'au_gout' },
  ],
  steps: [{ text: 'Fais cuire les pâtes dans la sauce.', timer_sec: 600, tip: 'Remue souvent.' }],
});

function messages(input: unknown): string[] {
  const result = recipeSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('recipeSchema', () => {
  it('accepte une recette complète et applique les valeurs par défaut', () => {
    const recipe = recipeSchema.parse(validRecipe());
    expect(recipe.tags).toEqual([]);
    expect(recipe.published).toBe(true);
  });

  it('refuse les champs inconnus (fautes de frappe)', () => {
    expect(messages({ ...validRecipe(), titel: 'x' })[0]).toMatch(/titel/);
  });

  it('refuse les unités hors liste, dont kg (tout en g pour R-04)', () => {
    const recipe = validRecipe();
    recipe.ingredients = [{ name: 'farine', quantity: 1, unit: 'kg' as 'g' }];
    expect(messages(recipe)).toEqual([
      expect.stringMatching(/^ingredients\.0\.unit: unité inconnue/),
    ]);
  });

  it('exige une quantité, sauf avec au_gout où elle est interdite', () => {
    const recipe = validRecipe();
    recipe.ingredients = [
      { name: 'farine', unit: 'g' },
      { name: 'sel', quantity: 2, unit: 'au_gout' },
    ];
    expect(messages(recipe)).toEqual([
      expect.stringMatching(/^ingredients\.0\.quantity: quantité manquante/),
      expect.stringMatching(/^ingredients\.1\.quantity: pas de quantité/),
    ]);
  });

  it('limite les portions de 1 à 6 (R-04)', () => {
    expect(messages({ ...validRecipe(), servings_base: 7 })).toEqual([
      'servings_base: 6 portions maximum (R-04)',
    ]);
    expect(messages({ ...validRecipe(), servings_base: 0 })).toHaveLength(1);
  });

  it('exige un coût entier en centimes', () => {
    expect(messages({ ...validRecipe(), cost_cents_per_serving: 1.2 })[0]).toMatch(/centimes/);
  });

  it('refuse un slug avec majuscules ou accents', () => {
    expect(messages({ ...validRecipe(), slug: 'Pâtes' })[0]).toMatch(/^slug: /);
  });

  it('refuse un équipement inconnu ou en double', () => {
    expect(messages({ ...validRecipe(), equipment: ['barbecue'] })).toHaveLength(1);
    expect(messages({ ...validRecipe(), equipment: ['four', 'four'] })[0]).toMatch(/double/);
    expect(messages({ ...validRecipe(), equipment: [] })[0]).toMatch(/au moins un/);
  });

  it('exige un minuteur entier en secondes', () => {
    const recipe = validRecipe();
    recipe.steps = [{ text: 'Laisse mijoter doucement.', timer_sec: 2.5 }];
    expect(messages(recipe)[0]).toMatch(/secondes/);
  });
});

describe('challengeSchema', () => {
  const challenge = {
    week_start: '2026-10-12',
    title: 'Semaine des pâtes',
    description: 'Cuisine une recette de pâtes cette semaine.',
    eligible_recipes: ['pates-one-pot'],
    badge_code: 'roi_des_pates',
  };

  it('accepte un défi et met 50 XP par défaut (R-14)', () => {
    expect(challengeSchema.parse(challenge).bonus_xp).toBe(50);
  });

  it('exige que week_start soit un lundi (R-02)', () => {
    const result = challengeSchema.safeParse({ ...challenge, week_start: '2026-10-13' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/lundi/);
  });
});

describe('contentJsonSchema', () => {
  it('produit un schéma draft-07 strict avec les descriptions en français', () => {
    const schema = contentJsonSchema('recipe');
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).toContain('en centimes');
  });
});
