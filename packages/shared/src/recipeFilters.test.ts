import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  availableTags,
  countActiveFilters,
  filterRecipes,
  formatDuration,
  formatEuros,
  isEquipment,
  tagLabel,
  toggleThreshold,
  toggleValue,
  type RecipeFilters,
} from './recipeFilters';

const recipes = [
  {
    id: 'pates',
    total_min: 20,
    cost_cents_per_serving: 90,
    equipment: ['plaques'],
    tags: ['vegetarien', 'express'],
  },
  {
    id: 'dahl',
    total_min: 35,
    cost_cents_per_serving: 110,
    equipment: ['plaques'],
    tags: ['vegetarien', 'vegan', 'batch-cooking'],
  },
  {
    id: 'gratin',
    total_min: 50,
    cost_cents_per_serving: 180,
    equipment: ['plaques', 'four'],
    tags: ['vegetarien'],
  },
  {
    id: 'mug-cake',
    total_min: 5,
    cost_cents_per_serving: 60,
    equipment: ['micro_ondes'],
    tags: ['dessert', 'express'],
  },
];

const ids = (filters: Partial<RecipeFilters>) =>
  filterRecipes(recipes, { ...EMPTY_FILTERS, ...filters }).map((r) => r.id);

describe('filterRecipes', () => {
  it('sans filtre : tout, dans l’ordre reçu', () => {
    expect(ids({})).toEqual(['pates', 'dahl', 'gratin', 'mug-cake']);
  });

  it('temps : durée totale ≤ maximum (borne incluse)', () => {
    expect(ids({ maxTotalMin: 30 })).toEqual(['pates', 'mug-cake']);
    expect(ids({ maxTotalMin: 35 })).toEqual(['pates', 'dahl', 'mug-cake']);
  });

  it('budget : coût par portion ≤ maximum (borne incluse)', () => {
    expect(ids({ maxCostCents: 100 })).toEqual(['pates', 'mug-cake']);
    expect(ids({ maxCostCents: 110 })).toEqual(['pates', 'dahl', 'mug-cake']);
  });

  it('équipement : la recette n’exige rien d’autre que ce que j’ai', () => {
    expect(ids({ equipment: ['plaques'] })).toEqual(['pates', 'dahl']);
    expect(ids({ equipment: ['micro_ondes'] })).toEqual(['mug-cake']);
    expect(ids({ equipment: ['plaques', 'four'] })).toEqual(['pates', 'dahl', 'gratin']);
    expect(ids({ equipment: ['four'] })).toEqual([]);
  });

  it('tags : tous les tags choisis sont exigés', () => {
    expect(ids({ tags: ['express'] })).toEqual(['pates', 'mug-cake']);
    expect(ids({ tags: ['vegetarien', 'express'] })).toEqual(['pates']);
    expect(ids({ tags: ['inconnu'] })).toEqual([]);
  });

  it('les filtres se combinent', () => {
    expect(ids({ maxTotalMin: 45, maxCostCents: 150, tags: ['vegetarien'] })).toEqual([
      'pates',
      'dahl',
    ]);
    expect(ids({ maxTotalMin: 15, equipment: ['plaques', 'micro_ondes'] })).toEqual(['mug-cake']);
    expect(ids({ maxCostCents: 100, tags: ['vegan'] })).toEqual([]);
  });
});

describe('outils de sélection', () => {
  it('countActiveFilters', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        maxTotalMin: 30,
        maxCostCents: 100,
        equipment: ['four', 'plaques'],
        tags: ['vegan'],
      }),
    ).toBe(5);
  });

  it('toggleValue ajoute puis retire', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('toggleThreshold : choix unique désélectionnable', () => {
    expect(toggleThreshold(null, 30)).toBe(30);
    expect(toggleThreshold(15, 30)).toBe(30);
    expect(toggleThreshold(30, 30)).toBeNull();
  });

  it('availableTags : par fréquence puis ordre alphabétique', () => {
    expect(availableTags(recipes)).toEqual([
      'vegetarien',
      'express',
      'batch-cooking',
      'dessert',
      'vegan',
    ]);
    expect(availableTags([])).toEqual([]);
  });

  it('isEquipment', () => {
    expect(isEquipment('four')).toBe(true);
    expect(isEquipment('barbecue')).toBe(false);
  });
});

describe('libellés', () => {
  it('tagLabel : connu ou déduit du slug', () => {
    expect(tagLabel('vegetarien')).toBe('Végétarien');
    expect(tagLabel('petit-dej')).toBe('Petit dej');
  });

  it('formatEuros', () => {
    expect(formatEuros(120)).toBe('1,20\u00a0€');
    expect(formatEuros(5)).toBe('0,05\u00a0€');
    expect(formatEuros(250)).toBe('2,50\u00a0€');
  });

  it('formatDuration', () => {
    expect(formatDuration(25)).toBe('25\u00a0min');
    expect(formatDuration(60)).toBe('1\u00a0h');
    expect(formatDuration(95)).toBe('1\u00a0h\u00a035');
    expect(formatDuration(65)).toBe('1\u00a0h\u00a005');
  });
});
