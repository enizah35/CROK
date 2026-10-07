# CROK v2 : plan technique du MVP

Produit par l'agent `architecte` du Chef (mission `2026-10-07-crok-v2-architecture`) à partir de [vision.md](vision.md) uniquement. Le dépôt enizah35/CROK est vide ; l'ancienne spec (skills crok-*) est ignorée.

Mascotte proposée : **Pépin**, une tomate (la graine, et « un petit pépin » pour rire d'un plat raté). Autres noms : Tomi, Rosa.

## 1. Règles fonctionnelles

**Semaine et temps**
- R-01 Une seule horloge, Europe/Paris. Une semaine va du lundi 00:00 au dimanche 23:59:59, calculée par le serveur ; l'heure du téléphone n'est jamais utilisée.
- R-02 `week_start` = date du lundi (heure de Paris). Une fonction unique dans `shared`, avec son équivalent SQL, testées sur les changements d'heure.

**Cuisson guidée**
- R-03 Lancer une recette crée une `cook_session` `en_cours`, `started_at` posé par le serveur. Au plus une session en cours ; en lancer une autre abandonne la précédente.
- R-04 Portions de 1 à 6. Quantités × portions/portions_base, arrondies selon l'unité (g à 5 près, pièces à la demi-unité). Les ingrédients `non_scalable` ne changent pas.
- R-05 Une étape par écran, navigation libre avant/arrière. Minuteurs locaux qui continuent en arrière-plan avec notification locale. Écran maintenu allumé.
- R-06 Session reprenable pendant 6 h ; au-delà, abandonnée, sans rien rapporter.
- R-07 Après la dernière étape, appareil photo dans l'app, sans galerie ni filtre. « Passer » → `terminee_sans_photo` : 0 XP, rien pour la série.

**Validation d'un plat (serveur uniquement)**
- R-08 Un plat n'est validé que par l'appel serveur `complete_cook_session(session, photo_path)`. Le client ne peut écrire ni XP, ni série, ni `dishes`.
- R-09 Conditions : session `en_cours` de l'appelant ; photo présente dans `dishes/{uid}/{session}` ; au moins max(5 min, 40 % du `active_min`) écoulés ; session de moins de 6 h.
- R-10 Une session donne au plus un plat.
- R-11 Au plus 2 plats comptés par jour et par utilisateur, et une même recette une fois par jour. Au-delà, plat publié avec 0 XP (`counted=false`).
- R-12 Photo dont l'empreinte SHA-256 est déjà connue pour cet utilisateur : refusée comme doublon.

**XP**
- R-13 Plat compté = 100 XP. Difficulté et beauté ne changent rien. Les réactions ne rapportent pas d'XP.
- R-14 Défi de la semaine réussi = +50 XP, une fois par semaine.
- R-15 Toute XP passe par le registre `xp_ledger` ; les totaux sont mis à jour dans la même transaction.

**Série hebdomadaire**
- R-16 Semaine réussie à partir de 3 plats comptés.
- R-17 Série = semaines réussies consécutives jusqu'à la semaine dernière, +1 si la semaine en cours est déjà réussie. La semaine en cours ne casse jamais la série avant dimanche soir. Calculée à la lecture, sans tâche planifiée.
- R-18 Le compteur x/3 repart à 0 le lundi à 00:00.

**Amis et invitations**
- R-19 Code ami de 8 caractères sans caractères ambigus ; lien `crok://i/CODE` avec page web de secours. Régénérer le code invalide l'ancien.
- R-20 Saisir un code crée l'amitié immédiatement, dans les deux sens. Pas soi-même, pas quelqu'un qui nous a bloqué, 50 amis maximum.
- R-21 Retirer un ami ou bloquer supprime l'amitié ; bloquer empêche un nouvel ajout. Aucune notification.
- R-22 On ne voit que les plats, profils et classement de ses amis. Rien de public. Photos dans un bucket privé, URL signée valable 1 h.

**Fil et réactions**
- R-23 Fil : mes plats et ceux de mes amis, du plus récent au plus ancien, 14 derniers jours, pages de 20.
- R-24 5 emojis fixes, une réaction par personne et par plat, modifiable ou retirable.
- R-25 L'auteur peut masquer son plat (XP conservée). Un ami peut signaler une photo ; Hugo modère à la main.

**Classement et défi**
- R-26 Classement hebdo : moi et mes amis, par XP de la semaine, puis nombre de plats, puis date du dernier plat (le plus ancien d'abord). Remise à zéro le lundi.
- R-27 Défi de la semaine commun à tous, défini par Hugo (recettes éligibles + badge). Réussi dès un plat compté sur une recette éligible. Badge attribué une fois.

**Rappel**
- R-28 Un rappel par jour maximum, à l'heure choisie (19 h par défaut), désactivable, programmé localement. Texte recalculé à chaque ouverture de l'app.
- R-29 Pas de rappel si un plat a déjà été validé ce jour-là, ni si l'objectif est atteint après jeudi.

**Mascotte Pépin**
- R-30 État calculé par priorité : `fete` (défi réussi depuis moins de 24 h), `fier` (plat validé aujourd'hui), `en_feu` (3/3), `motive` (1 ou 2 sur 3), `affame` (0/3 à partir de jeudi), sinon `neutre`.
- R-31 3 à 5 messages par état, tirés au sort. Aucun ne culpabilise ni ne commente la photo ; relus par Hugo.

**Compte**
- R-32 Inscription par code à 6 chiffres reçu par email ; pseudo unique de 3 à 20 caractères ; avatar parmi 12 ; case « J'ai 18 ans ou plus » obligatoire, enregistrée avec sa date.
- R-33 Suppression de compte dans l'app (stores et RGPD) : profil, photos, réactions et amitiés effacés sous 24 h.

## 2. Modèle de données (Postgres)

| Table | Champs essentiels | Contraintes clés |
|---|---|---|
| profiles | id = auth.uid, pseudo, avatar_id, friend_code, adult_confirmed_at, reminder_enabled, reminder_time, lifetime_xp | pseudo et friend_code uniques ; client limité à pseudo, avatar, rappel |
| recipes | id, slug, version, title, servings_base, total_min, active_min, cost_cents_per_serving, equipment[], tags[], ingredients jsonb, steps jsonb, cover_path, published | slug unique ; écriture service_role uniquement |
| cook_sessions | id, user_id, recipe_id, recipe_version, servings, started_at, finished_at, status | unique partiel (user_id) WHERE status='en_cours' |
| dishes | id, user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted, hidden, created_at | cook_session_id unique ; (user_id, photo_sha256) unique ; insertion par RPC |
| xp_ledger | id, user_id, week_start, amount, reason, dish_id, challenge_id | unique (dish_id, reason) et (user_id, challenge_id) |
| user_weeks | user_id, week_start, dishes_count, xp, goal_reached_at | PK (user_id, week_start) |
| friendships | user_a, user_b, created_at | CHECK user_a < user_b |
| blocks | blocker_id, blocked_id | PK des deux |
| reactions | dish_id, user_id, emoji | PK (dish_id, user_id) ; amitié vérifiée par RLS |
| challenges | id, week_start, title, description, eligible_recipe_ids[], badge_code, bonus_xp | week_start unique |
| user_badges | user_id, challenge_id, badge_code, earned_at | unique (user_id, challenge_id) |
| reports | id, reporter_id, dish_id, reason, status | unique (reporter_id, dish_id) |
| events | user_id, name, props jsonb, created_at | insertion seule (North Star, rétention) |

RLS sur toutes les tables ; fonction `are_friends(a, b)` utilisée par les policies ; bucket privé `dishes` lisible par le propriétaire et ses amis.

## 3. Stack

| Option | Atouts | Limites pour CROK |
|---|---|---|
| **Expo + Supabase** | TypeScript partout ; caméra, notifications, keep-awake natifs ; Postgres pour classements et séries, RLS, transactions pour l'XP ; builds EAS, mises à jour OTA | RLS à tester sérieusement ; projet gratuit mis en pause après 7 jours d'inactivité |
| Flutter + Firebase | UI performante | Dart à apprendre ; Firestore peu adapté aux classements ; anti-triche via Cloud Functions donc forfait payant |
| Expo + Convex | Temps réel, TypeScript de bout en bout | Moins de recul, plus de dépendance au fournisseur, pas de SQL |

**Choix : Expo (expo-router) + Supabase**, avec TanStack Query, expo-camera, expo-notifications, expo-keep-awake, expo-image-manipulator, Zod partagé, Jest et Vitest, pgTAP, EAS Build et Submit.

**Anti-triche :** XP, validation, série, défi, limites quotidiennes, doublons et classement vivent dans des fonctions Postgres transactionnelles testées en pgTAP. Le client n'écrit jamais dans `dishes`, `xp_ledger`, `user_weeks`, `user_badges`. Une seule Edge Function, pour la suppression de compte.

**Coûts bêta (environ 50 utilisateurs) :** Supabase gratuit en dev, Pro à 25 $/mois en bêta ; Apple 99 $/an ; Google Play 25 $ une fois ; domaine environ 10 €/an. Soit environ 0 à 25 $/mois plus environ 135 $ de frais fixes.

## 4. Dépôt, tests et CI

```
CROK/  (pnpm workspaces)
  app/                Expo : (auth) (onboarding) (tabs: recettes, fil, classement, profil) cook/[session]
    src/features/…    recipes, cook, dishes, friends, feed, leaderboard, mascot, reminders
  packages/shared/    Zod, portions, week_start, état de Pépin, messages, types générés
  supabase/           migrations/, functions/delete-account/, tests/ (pgTAP), seed.sql
  content/            recipes/*.yaml (Hugo), challenges/*.yaml, recipe.schema.json
  scripts/            recipes-check.ts, recipes-push.ts
  docs/               regles.md, RECETTES.md, CLAUDE.md
  .github/workflows/  ci.yml, content.yml
```

- **Tests** : Vitest sur toutes les règles pures ; pgTAP sur chaque policy (cas ami et cas inconnu) et chaque règle R-08 à R-27 ; Jest sur le mode cuisine et la capture photo ; parcours principal testé à la main sur un vrai téléphone avant chaque build de bêta.
- **CI** : lint, typecheck, Vitest, Jest, `supabase db test`, `recipes-check` si `content/` change, types générés à jour.
- **Manuel** : migrations en production par Hugo, builds EAS, pas de push direct sur `main`.

## 5. Découpage (une tâche = un agent = une PR)

**Phase 0 : socle**
| # | Tâche | Critère « terminé » |
|---|---|---|
| 0.1 | Monorepo pnpm, app Expo, `shared`, lint/TS strict, CI | CI verte ; l'app démarre sur iOS et Android |
| 0.2 | Supabase local : tables, RLS, types, harnais pgTAP | tests RLS ami/inconnu verts sur chaque table |
| 0.3 | **Format de recette + outil de saisie** (YAML commenté avec autocomplétion, `recipes:check` en français, `recipes:push`, guide, 3 exemples) | Hugo écrit une recette en moins de 15 min ; erreur signalée avec la ligne |
| 0.4 | Auth par code email, onboarding (pseudo, avatar, 18+) | pseudo en double refusé ; sans 18+, bloqué |
| 0.5 | Kit UI + Pépin en illustrations provisoires | contraste et zones tactiles conformes |

**Phase 1 : boucle complète en solo**
| # | Tâche | Critère « terminé » |
|---|---|---|
| 1.1 | Catalogue, filtres, fiche recette avec portions | filtres et portions testés |
| 1.2 | Mode cuisine (R-03 à R-06) | app tuée puis relancée : la session reprend |
| 1.3 | Règles serveur : validation, XP, série (R-08 à R-18) | pgTAP couvre chaque règle et ses cas limites |
| 1.4 | Capture photo, upload, validation, écran de récompense | XP visible ; « Passer » ne donne rien ; pas de doublon en cas d'échec réseau |
| 1.5 | Profil et progression | valeurs identiques aux fonctions SQL |
| 1.6 | Relecture des 30 recettes de Hugo | `recipes-check` vert ; remarques remises |

**Phase 2 : social**
| # | Tâche | Critère « terminé » |
|---|---|---|
| 2.1 | Amis : code, lien, ajout, retrait, blocage | ajout par lien depuis un autre téléphone |
| 2.2 | Fil, URLs signées, masquer, signaler | un inconnu n'obtient aucune photo |
| 2.3 | Réactions | impossible sur le plat d'un non-ami |
| 2.4 | Classement hebdo | tri et remise à zéro testés |
| 2.5 | Défi de la semaine | bonus une seule fois ; badge visible |
| 2.6 | Suppression de compte + mentions légales | plus aucune donnée après suppression |

**Phase 3 : mascotte, rappels, bêta**
| # | Tâche | Critère « terminé » |
|---|---|---|
| 3.1 | Pépin : états et messages | états testés ; messages relus par Hugo |
| 3.2 | Rappel quotidien local | absent après un plat du jour ; désactivable |
| 3.3 | Mesure North Star et rétention | vues SQL disponibles |
| 3.4 | Builds, TestFlight, test Play, fiches stores | installable par 5 testeurs ; **soumission validée par Hugo** |

## 6. Risques
1. **Contenu** : les recettes de Hugo sont sur le chemin critique. Viser 10 recettes avant la fin de la phase 1.
2. **Triche photo** : impossible à bloquer totalement ; caméra dans l'app, délai minimum, limites quotidiennes, doublons, signalement.
3. **Fuite de photos par erreur de RLS** : test « inconnu » obligatoire, bucket privé.
4. **Revue Apple** : signalement, blocage et suppression de compte obligatoires (prévus).
5. **Minuteurs et notifications sous iOS** : tests sur vrais appareils.

## Questions ouvertes (défaut proposé)
1. **Notifications push pour les réactions ?** Non au MVP, pastille dans l'app.
2. **Connexion** : code email seul. Apple et Google = une tâche de plus.
3. **Nom de la mascotte** : Pépin (sinon Tomi ou Rosa) ; illustrations provisoires jusqu'à la phase 3.
4. **Domaine pour les liens d'invitation** (environ 10 €/an) : oui.
5. **Délai minimum avant validation** (40 % du temps actif, 5 min au moins) : conservé, à ajuster en bêta.
