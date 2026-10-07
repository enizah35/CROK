import { recipeSchema, type Ingredient, type Step, type Tables } from '@crok/shared';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type RecipeRow = Tables<'recipes'>;

/** Colonnes nécessaires à la liste : pas d'ingrédients ni d'étapes. */
const SUMMARY_COLUMNS =
  'id, slug, title, servings_base, total_min, cost_cents_per_serving, equipment, tags, cover_path';
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, active_min, version, ingredients, steps`;

export type RecipeSummary = Pick<
  RecipeRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'servings_base'
  | 'total_min'
  | 'cost_cents_per_serving'
  | 'equipment'
  | 'tags'
  | 'cover_path'
>;

export type RecipeDetail = RecipeSummary &
  Pick<RecipeRow, 'active_min' | 'version'> & {
    ingredients: Ingredient[];
    steps: Step[];
  };

export const recipeKeys = {
  all: ['recipes'] as const,
  list: () => [...recipeKeys.all, 'list'] as const,
  detail: (id: string) => [...recipeKeys.all, 'detail', id] as const,
};

/** Erreur levée si les ingrédients ou étapes stockés ne respectent pas le format (tâche 0.3). */
export class InvalidRecipeError extends Error {
  constructor(recipeId: string) {
    super(`Recette ${recipeId} : ingrédients ou étapes illisibles`);
    this.name = 'InvalidRecipeError';
  }
}

/**
 * Valide les colonnes jsonb `ingredients` et `steps` avec les schémas de `@crok/shared` :
 * la base les type en Json, l'app a besoin d'Ingredient[] et Step[].
 */
export function parseRecipeDetail(
  row: Omit<RecipeDetail, 'ingredients' | 'steps'> & { ingredients: unknown; steps: unknown },
): RecipeDetail {
  const ingredients = recipeSchema.shape.ingredients.safeParse(row.ingredients);
  const steps = recipeSchema.shape.steps.safeParse(row.steps);
  if (!ingredients.success || !steps.success) throw new InvalidRecipeError(row.id);
  return { ...row, ingredients: ingredients.data, steps: steps.data };
}

/** Recettes publiées (la RLS ne laisse de toute façon lire que celles-là), par titre. */
export function useRecipes() {
  return useQuery({
    queryKey: recipeKeys.list(),
    queryFn: async (): Promise<RecipeSummary[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select(SUMMARY_COLUMNS)
        .eq('published', true)
        .order('title');
      if (error) throw error;
      return data;
    },
  });
}

/** Une recette publiée avec ses ingrédients et étapes ; `null` si elle n'existe pas. */
export function useRecipe(id: string) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    enabled: id.length > 0,
    queryFn: async (): Promise<RecipeDetail | null> => {
      const { data, error } = await supabase
        .from('recipes')
        .select(DETAIL_COLUMNS)
        .eq('id', id)
        .eq('published', true)
        .maybeSingle();
      if (error) throw error;
      return data ? parseRecipeDetail(data) : null;
    },
  });
}
