/**
 * Publication des recettes vers la table `recipes` (plan technique §2), par slug.
 *
 * - Une recette absente en base est créée en version 1.
 * - Une recette dont le contenu a changé (empreinte SHA-256) passe en version + 1.
 * - Une recette identique n'est pas réécrite : relancer la publication ne change rien.
 *
 * La comparaison se fait sur le contenu relu en base : pas besoin de colonne d'empreinte.
 */
import { createHash } from 'node:crypto';

import type { Recipe } from '@crok/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Colonnes de `recipes` écrites par la publication (hors `id`, généré par la base). */
export interface RecipeRow {
  slug: string;
  version: number;
  title: string;
  servings_base: number;
  total_min: number;
  active_min: number;
  cost_cents_per_serving: number;
  equipment: string[];
  tags: string[];
  ingredients: Recipe['ingredients'];
  steps: Recipe['steps'];
  cover_path: string | null;
  published: boolean;
}

export const RECIPE_COLUMNS = [
  'slug',
  'version',
  'title',
  'servings_base',
  'total_min',
  'active_min',
  'cost_cents_per_serving',
  'equipment',
  'tags',
  'ingredients',
  'steps',
  'cover_path',
  'published',
] as const satisfies readonly (keyof RecipeRow)[];

/** Accès à la table `recipes` : implémenté par Supabase, ou par un faux en test. */
export interface RecipeStore {
  fetchAll(): Promise<RecipeRow[]>;
  upsert(rows: RecipeRow[]): Promise<void>;
}

export type PushAction = 'creation' | 'mise_a_jour' | 'inchangee';

export interface PlannedRecipe {
  slug: string;
  action: PushAction;
  /** Version après publication. */
  version: number;
  previousVersion?: number;
  hash: string;
  row: RecipeRow;
}

export interface PushPlan {
  entries: PlannedRecipe[];
  /** Slugs présents en base mais plus dans `content/recipes/` (jamais supprimés automatiquement). */
  onlyRemote: string[];
}

type RowContent = Omit<RecipeRow, 'version'>;

/** Sérialisation JSON à clés triées : l'ordre des clés renvoyé par Postgres (jsonb) n'importe pas. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function contentOf(row: RecipeRow | RowContent): RowContent {
  const content: RowContent = {
    slug: row.slug,
    title: row.title,
    servings_base: row.servings_base,
    total_min: row.total_min,
    active_min: row.active_min,
    cost_cents_per_serving: row.cost_cents_per_serving,
    equipment: row.equipment,
    tags: row.tags,
    ingredients: row.ingredients,
    steps: row.steps,
    cover_path: row.cover_path ?? null,
    published: row.published,
  };
  return content;
}

export function contentHash(row: RecipeRow | RowContent): string {
  return createHash('sha256')
    .update(canonicalJson(contentOf(row)))
    .digest('hex');
}

/** Recette validée → ligne de la table (sans la version, décidée par le plan). */
export function recipeToContent(recipe: Recipe): RowContent {
  return {
    slug: recipe.slug,
    title: recipe.title,
    servings_base: recipe.servings_base,
    total_min: recipe.total_min,
    active_min: recipe.active_min,
    cost_cents_per_serving: recipe.cost_cents_per_serving,
    equipment: [...recipe.equipment],
    tags: [...recipe.tags],
    // On retire les champs absents (undefined) pour que le jsonb stocké soit stable.
    ingredients: JSON.parse(JSON.stringify(recipe.ingredients)) as Recipe['ingredients'],
    steps: JSON.parse(JSON.stringify(recipe.steps)) as Recipe['steps'],
    cover_path: recipe.cover ?? null,
    published: recipe.published,
  };
}

export function planPush(recipes: readonly Recipe[], remote: readonly RecipeRow[]): PushPlan {
  const remoteBySlug = new Map(remote.map((row) => [row.slug, row]));
  const localSlugs = new Set(recipes.map((recipe) => recipe.slug));

  const entries = recipes.map((recipe): PlannedRecipe => {
    const content = recipeToContent(recipe);
    const hash = contentHash(content);
    const existing = remoteBySlug.get(recipe.slug);
    if (!existing) {
      return {
        slug: recipe.slug,
        action: 'creation',
        version: 1,
        hash,
        row: { ...content, version: 1 },
      };
    }
    if (contentHash(existing) === hash) {
      return {
        slug: recipe.slug,
        action: 'inchangee',
        version: existing.version,
        previousVersion: existing.version,
        hash,
        row: { ...content, version: existing.version },
      };
    }
    const version = existing.version + 1;
    return {
      slug: recipe.slug,
      action: 'mise_a_jour',
      version,
      previousVersion: existing.version,
      hash,
      row: { ...content, version },
    };
  });

  const onlyRemote = remote
    .map((row) => row.slug)
    .filter((slug) => !localSlugs.has(slug))
    .sort();
  return { entries, onlyRemote };
}

/** Calcule le plan puis, hors `dryRun`, écrit les recettes nouvelles ou modifiées. */
export async function pushRecipes(
  recipes: readonly Recipe[],
  store: RecipeStore | null,
  options: { dryRun: boolean },
): Promise<PushPlan> {
  const remote = store ? await store.fetchAll() : [];
  const plan = planPush(recipes, remote);
  const changed = plan.entries
    .filter((entry) => entry.action !== 'inchangee')
    .map((entry) => entry.row);
  if (!options.dryRun && changed.length > 0) {
    if (!store) throw new Error('Aucune connexion à Supabase : publication impossible.');
    await store.upsert(changed);
  }
  return plan;
}

/** Implémentation Supabase de `RecipeStore` (clé service_role : script local uniquement). */
export function createSupabaseStore(client: SupabaseClient): RecipeStore {
  return {
    async fetchAll() {
      const { data, error } = await client.from('recipes').select(RECIPE_COLUMNS.join(','));
      if (error) throw new Error(`Lecture de la table recipes impossible : ${error.message}`);
      return (data ?? []) as unknown as RecipeRow[];
    },
    async upsert(rows) {
      const { error } = await client.from('recipes').upsert(rows, { onConflict: 'slug' });
      if (error) throw new Error(`Écriture dans la table recipes impossible : ${error.message}`);
    },
  };
}
