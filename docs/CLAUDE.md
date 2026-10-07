# CROK : conventions pour les agents et les humains

Sources de vérité : [vision.md](vision.md) (produit) et [plan-technique.md](plan-technique.md)
(règles R-xx, modèle de données, stack, découpage en tâches). Les anciens skills `crok-*`
décrivent une version abandonnée : ne pas les suivre.

## Dépôt

| Dossier            | Contenu                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `app/`             | App Expo (expo-router). Routes dans `app/src/app/`, code métier dans `app/src/features/<domaine>/` |
| `packages/shared/` | `@crok/shared` : fonctions pures partagées (semaine, portions, état de Pépin, Zod), testées avec Vitest |
| `supabase/`        | Migrations, tests pgTAP, Edge Function `delete-account` (tâche 0.2)     |
| `content/`         | Recettes et défis en YAML (tâche 0.3)                                   |
| `scripts/`         | `@crok/scripts` : `recipes-check`, `recipes-push` (secrets dans `scripts/.env.local`) |

## Commandes (à la racine)

```bash
corepack enable          # une fois : active la version de pnpm fixée dans package.json
pnpm install
pnpm lint                # ESLint (0 avertissement toléré) + Prettier --check
pnpm format              # Prettier --write
pnpm typecheck           # tsc --noEmit dans chaque paquet
pnpm test                # Vitest (packages/shared, scripts) + Jest/Testing Library (app)
pnpm recipes:check       # vérifie content/ (recettes et défis), voir docs/RECETTES.md
pnpm recipes:push        # publie les recettes dans Supabase (--dry-run pour simuler)
pnpm recipes:schema      # régénère content/*.schema.json après un changement du schéma Zod
pnpm run ci              # lint + typecheck + test + recipes:check, comme la CI GitHub
pnpm --filter @crok/app start   # serveur de dev Expo

# Supabase local (Docker requis)
pnpm db:start            # démarre la pile locale
pnpm db:reset            # rejoue toutes les migrations de supabase/migrations/
pnpm db:test             # tests pgTAP de supabase/tests/
pnpm db:types            # régénère packages/shared/src/database.types.ts (à committer)
```

En local, les emails (code de connexion à 6 chiffres, modèle `supabase/templates/`) arrivent
dans Mailpit : http://127.0.0.1:54324. Pour avoir les recettes exemples après un `db:reset` :
`pnpm recipes:push` avec `scripts/.env.local` rempli (clé service_role de `supabase status`).
Types de la base côté app : `import type { Database, Tables } from '@crok/shared'` (générés,
jamais écrits à la main).

Base de données : toute modification passe par une nouvelle migration
(`pnpm exec supabase migration new <nom>`), jamais par une édition d'une migration déjà poussée.
Chaque nouvelle table : RLS activée, droits accordés explicitement à `authenticated` (aucun droit
par défaut), tests pgTAP « ami » et « inconnu », puis `pnpm db:types`. Fonction security definer :
`revoke execute ... from public, anon` puis `grant execute ... to authenticated` si le client l'appelle.

Ajouter une dépendance native à l'app : `cd app && npx expo install <paquet>` (versions
compatibles avec le SDK). Si l'API Expo n'est pas joignable, prendre la version indiquée dans
`node_modules/expo/bundledNativeModules.json`.

## Règles

- **TypeScript strict partout**, `noUncheckedIndexedAccess` compris. **Pas de `any`** (erreur
  ESLint) : utiliser `unknown` puis valider (Zod).
- **Les règles métier R-xx** de `plan-technique.md` font foi. Citer la règle (`// R-11`) dans le
  code et les tests qui l'implémentent.
- **Aucune logique d'XP, de série, de validation de plat, de limite quotidienne ni de classement
  côté client** (R-08, R-15). L'app affiche ce que renvoie le serveur ; elle n'écrit jamais dans
  `dishes`, `xp_ledger`, `user_weeks`, `user_badges`.
- **Une seule horloge : Europe/Paris** (R-01). Ne jamais utiliser `getDay()`, `getHours()`, etc.
  sur l'heure locale du téléphone pour une règle métier ; passer par `@crok/shared`
  (`weekStart`, `dayParis`). Toute fonction de `shared` qui a un équivalent SQL doit être
  testée avec les mêmes cas des deux côtés.
- **UI : passer par le kit `@/ui`** (tokens, `useTheme`, composants, `<Pepin etat=… />`). Pas de
  couleur en dur dans les écrans ; toute nouvelle paire texte/fond s'ajoute au test de contraste
  `app/src/ui/__tests__/tokens.test.ts`. Catalogue en dev : route `/_catalogue`.
- **Logique pure dans `packages/shared/`**, avec ses tests Vitest. Les composants restent minces.
- **Une PR par tâche du plan**, sur une branche `agent/<n°>-<slug>`. Jamais de push direct sur
  `main`. La CI (`pnpm run ci`) doit être verte.
- **Aucun secret** dans le dépôt. Variables d'app dans `app/.env.local` (voir `.env.example`) ;
  seules les `EXPO_PUBLIC_*` sont lues par l'app et elles sont publiques par nature.
- Migrations en production, builds EAS et soumissions aux stores : uniquement par Hugo.
- Code et identifiants en anglais ; textes de l'app, commentaires métier et docs en français.
