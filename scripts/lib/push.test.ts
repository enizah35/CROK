import { recipeSchema } from '@crok/shared';
import type { Recipe, RecipeInput } from '@crok/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import {
  canonicalJson,
  contentHash,
  createSupabaseStore,
  planPush,
  pushRecipes,
  recipeToContent,
} from './push';
import type { RecipeRow, RecipeStore } from './push';

function makeRecipe(overrides: Partial<RecipeInput> = {}): Recipe {
  return recipeSchema.parse({
    slug: 'riz-saute',
    title: 'Riz sauté',
    servings_base: 2,
    total_min: 30,
    active_min: 15,
    cost_cents_per_serving: 85,
    equipment: ['plaques'],
    ingredients: [
      { name: 'riz', quantity: 150, unit: 'g' },
      { name: 'sel', unit: 'au_gout' },
    ],
    steps: [{ text: "Fais cuire le riz dans l'eau salée.", timer_sec: 600 }],
    ...overrides,
  });
}

/** Faux client Supabase : juste ce qu'utilise `createSupabaseStore`, sur un tableau en mémoire. */
function fakeSupabase(table: RecipeRow[]) {
  const calls = {
    select: 0,
    upsert: [] as { rows: RecipeRow[]; onConflict: string | undefined }[],
  };
  const client = {
    from(name: string) {
      expect(name).toBe('recipes');
      return {
        select(columns: string) {
          calls.select += 1;
          const keys = columns.split(',');
          // Postgres renvoie le jsonb avec ses clés réordonnées : on simule ce comportement.
          const rows = table.map((row) =>
            Object.fromEntries(
              keys.map((key) => [key, JSON.parse(canonicalJson(row[key as keyof RecipeRow]))]),
            ),
          );
          return Promise.resolve({ data: structuredClone(rows), error: null });
        },
        upsert(rows: RecipeRow[], options?: { onConflict?: string }) {
          calls.upsert.push({ rows: structuredClone(rows), onConflict: options?.onConflict });
          for (const row of rows) {
            const index = table.findIndex((existing) => existing.slug === row.slug);
            if (index >= 0) table[index] = structuredClone(row);
            else table.push(structuredClone(row));
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('planPush', () => {
  it('crée en version 1 une recette absente de la base', () => {
    const plan = planPush([makeRecipe()], []);
    expect(plan.entries).toEqual([
      expect.objectContaining({ slug: 'riz-saute', action: 'creation', version: 1 }),
    ]);
    expect(plan.entries[0]?.row).toMatchObject({ cover_path: null, published: true, tags: [] });
  });

  it('ne change rien si le contenu est identique', () => {
    const row = { ...recipeToContent(makeRecipe()), version: 3 };
    const plan = planPush([makeRecipe()], [row]);
    expect(plan.entries[0]).toMatchObject({ action: 'inchangee', version: 3 });
  });

  it('passe en version + 1 si le contenu a changé', () => {
    const row = { ...recipeToContent(makeRecipe()), version: 3 };
    const plan = planPush([makeRecipe({ title: 'Riz sauté express' })], [row]);
    expect(plan.entries[0]).toMatchObject({
      action: 'mise_a_jour',
      previousVersion: 3,
      version: 4,
    });
  });

  it('signale sans les supprimer les recettes présentes seulement en base', () => {
    const other = { ...recipeToContent(makeRecipe({ slug: 'ancienne' })), version: 1 };
    expect(planPush([makeRecipe()], [other]).onlyRemote).toEqual(['ancienne']);
  });

  it("l'empreinte ignore l'ordre des clés mais pas l'ordre des étapes", () => {
    const content = recipeToContent(makeRecipe());
    const reordered = JSON.parse(canonicalJson(content)) as typeof content;
    expect(contentHash(reordered)).toBe(contentHash(content));
    const twoSteps = makeRecipe({
      steps: [{ text: 'Première étape du plat.' }, { text: 'Deuxième étape du plat.' }],
    });
    const swapped = {
      ...recipeToContent(twoSteps),
      steps: [...recipeToContent(twoSteps).steps].reverse(),
    };
    expect(contentHash(swapped)).not.toBe(contentHash(recipeToContent(twoSteps)));
  });
});

describe('pushRecipes avec un client Supabase mocké', () => {
  it('publie, puis une seconde publication ne réécrit rien (idempotence)', async () => {
    const table: RecipeRow[] = [];
    const { client, calls } = fakeSupabase(table);
    const store = createSupabaseStore(client);

    const first = await pushRecipes([makeRecipe()], store, { dryRun: false });
    expect(first.entries.map((e) => e.action)).toEqual(['creation']);
    expect(calls.upsert).toHaveLength(1);
    expect(calls.upsert[0]?.onConflict).toBe('slug');

    const second = await pushRecipes([makeRecipe()], store, { dryRun: false });
    expect(second.entries.map((e) => e.action)).toEqual(['inchangee']);
    expect(calls.upsert).toHaveLength(1);

    const third = await pushRecipes([makeRecipe({ active_min: 12 })], store, { dryRun: false });
    expect(third.entries[0]).toMatchObject({ action: 'mise_a_jour', version: 2 });
    expect(table[0]).toMatchObject({ version: 2, active_min: 12 });
  });

  it('--dry-run lit la base mais n’écrit jamais, et donne deux fois le même plan', async () => {
    const { client, calls } = fakeSupabase([{ ...recipeToContent(makeRecipe()), version: 1 }]);
    const store = createSupabaseStore(client);
    const recipes = [makeRecipe({ title: 'Riz sauté v2' }), makeRecipe({ slug: 'nouvelle' })];

    const a = await pushRecipes(recipes, store, { dryRun: true });
    const b = await pushRecipes(recipes, store, { dryRun: true });
    expect(a).toEqual(b);
    expect(a.entries.map((e) => [e.slug, e.action, e.version])).toEqual([
      ['riz-saute', 'mise_a_jour', 2],
      ['nouvelle', 'creation', 1],
    ]);
    expect(calls.select).toBe(2);
    expect(calls.upsert).toEqual([]);
  });

  it('--dry-run sans connexion simule contre une base vide', async () => {
    const plan = await pushRecipes([makeRecipe()], null, { dryRun: true });
    expect(plan.entries[0]?.action).toBe('creation');
  });

  it('refuse d’écrire sans connexion', async () => {
    await expect(pushRecipes([makeRecipe()], null, { dryRun: false })).rejects.toThrow(/Supabase/);
  });

  it('remonte les erreurs Supabase en français', async () => {
    const failing = {
      from: () => ({
        select: () =>
          Promise.resolve({ data: null, error: { message: 'relation "recipes" does not exist' } }),
      }),
    } as unknown as SupabaseClient;
    const store: RecipeStore = createSupabaseStore(failing);
    await expect(store.fetchAll()).rejects.toThrow(/Lecture de la table recipes impossible/);
  });
});
