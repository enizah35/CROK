import type { RecipeDetail, RecipeSummary } from './api';

export const summaries: RecipeSummary[] = [
  {
    id: 'id-dahl',
    slug: 'dahl-lentilles-corail',
    title: 'Dahl de lentilles corail',
    servings_base: 4,
    total_min: 35,
    cost_cents_per_serving: 110,
    equipment: ['plaques'],
    tags: ['vegetarien', 'vegan'],
    cover_path: null,
  },
  {
    id: 'id-gratin',
    slug: 'gratin-dauphinois',
    title: 'Gratin dauphinois',
    servings_base: 4,
    total_min: 70,
    cost_cents_per_serving: 140,
    equipment: ['plaques', 'four'],
    tags: ['vegetarien'],
    cover_path: null,
  },
  {
    id: 'id-mug',
    slug: 'mug-cake',
    title: 'Mug cake chocolat',
    servings_base: 1,
    total_min: 5,
    cost_cents_per_serving: 60,
    equipment: ['micro_ondes'],
    tags: ['express'],
    cover_path: null,
  },
];

export const dahl: RecipeDetail = {
  ...(summaries[0] as RecipeSummary),
  active_min: 12,
  version: 1,
  ingredients: [
    { name: 'lentilles corail', quantity: 250, unit: 'g' },
    { name: 'oignon', quantity: 1, unit: 'piece' },
    { name: 'curry', quantity: 2, unit: 'cuillere_cafe' },
    { name: 'feuille de laurier', quantity: 1, unit: 'piece', non_scalable: true },
    { name: 'sel', unit: 'au_gout' },
  ],
  steps: [
    { text: 'Émince l’oignon finement.' },
    { text: 'Fais revenir l’oignon avec le curry.', timer_sec: 180 },
    { text: 'Ajoute les lentilles et couvre d’eau.' },
  ],
};
