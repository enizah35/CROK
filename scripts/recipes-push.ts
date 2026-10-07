/**
 * `pnpm recipes:push` : publie les recettes de `content/recipes/` dans Supabase (upsert par slug).
 * `pnpm recipes:push --dry-run` : affiche ce qui serait fait, sans rien écrire.
 *
 * Secrets lus dans l'environnement ou dans `scripts/.env.local` (jamais versionné) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * La clé service_role contourne la RLS : elle ne doit jamais être préfixée EXPO_PUBLIC_
 * (elle serait embarquée dans l'app) ni commitée.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { formatIssue } from './lib/check';
import { checkContentDir, REPO_ROOT } from './lib/files';
import { createSupabaseStore, pushRecipes } from './lib/push';
import type { PlannedRecipe, RecipeStore } from './lib/push';

const dryRun = process.argv.includes('--dry-run');

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const envFile = join(REPO_ROOT, 'scripts', '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (
  Object.keys(process.env).some(
    (name) => name.startsWith('EXPO_PUBLIC_') && name.includes('SERVICE_ROLE'),
  )
) {
  fail(
    'Une variable EXPO_PUBLIC_…SERVICE_ROLE… est définie : la clé service_role ne doit jamais être exposée à l’app. Supprime-la et utilise SUPABASE_SERVICE_ROLE_KEY.',
  );
}

const check = checkContentDir();
const errors = check.issues.filter((issue) => issue.severity === 'erreur');
if (errors.length > 0) {
  for (const issue of errors) console.error(formatIssue(issue));
  fail(`${errors.length} erreur(s) dans content/ : rien n’a été publié. Lance pnpm recipes:check.`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let store: RecipeStore | null = null;
if (url && key) {
  store = createSupabaseStore(
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
} else if (dryRun) {
  console.log(
    'ℹ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent : simulation contre une base vide.\n',
  );
} else {
  fail(
    'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires. Remplis scripts/.env.local (modèle : scripts/.env.example).',
  );
}

const recipes = check.recipes.filter((entry) => !entry.template).map((entry) => entry.recipe);
const plan = await pushRecipes(recipes, store, { dryRun }).catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);

const label = (entry: PlannedRecipe): string => {
  if (entry.action === 'creation') return `+ ${entry.slug} : nouvelle recette (version 1)`;
  if (entry.action === 'mise_a_jour') {
    return `~ ${entry.slug} : modifiée (version ${entry.previousVersion ?? '?'} → ${entry.version})`;
  }
  return `= ${entry.slug} : inchangée (version ${entry.version})`;
};
for (const entry of plan.entries) console.log(`${label(entry)}  [${entry.hash.slice(0, 8)}]`);
for (const slug of plan.onlyRemote) {
  console.log(
    `? ${slug} : en base mais plus dans content/recipes/ (non supprimée ; mets published: false pour la masquer)`,
  );
}

const changed = plan.entries.filter((entry) => entry.action !== 'inchangee').length;
console.log('');
if (dryRun) {
  console.log(
    `Simulation (--dry-run) : ${changed} recette(s) seraient écrites, rien n’a été envoyé.`,
  );
} else {
  console.log(`✓ ${changed} recette(s) publiée(s), ${plan.entries.length - changed} inchangée(s).`);
}
