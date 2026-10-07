# API serveur de la phase 1

Fonctions Postgres appelées par l'app avec `supabase.rpc(...)`. Migration :
`supabase/migrations/20261009000000_cook_rules.sql` ; tests : `supabase/tests/cook_rules.test.sql`.

Toutes sont `security definer`, `set search_path = ''`, exécutables par `authenticated` seulement,
et calculent le temps côté serveur en heure de Paris (R-01). L'app n'ajoute aucune logique d'XP,
de série ni de limite : elle affiche ce que renvoient ces fonctions.

Le client lance une session par `INSERT` direct dans `cook_sessions` (`recipe_id`, `servings` ; le
trigger pose `started_at`, `status` et `recipe_version`, et abandonne la session précédente), change
les portions ou passe la session en `abandonnee` / `terminee_sans_photo` par `UPDATE`. Le statut
`terminee` n'est atteignable que par `complete_cook_session`.

## `get_active_cook_session() returns jsonb` (R-06)

Session `en_cours` de l'appelant si elle a moins de 6 h, sinon `null`. Une session de 6 h ou plus
est passée en `abandonnee` au passage (elle ne rapporte rien).

```json
{
  "id": "uuid",
  "recipe_id": "uuid",
  "recipe_version": 1,
  "servings": 2,
  "started_at": "2026-10-07T10:00:00+00:00",
  "server_now": "2026-10-07T10:42:00+00:00"
}
```

`server_now` permet d'afficher le temps écoulé sans se fier à l'horloge du téléphone.

## `complete_cook_session(p_session_id uuid, p_photo_path text, p_photo_sha256 text) returns jsonb` (R-08 à R-16)

Valide le plat dans une seule transaction : plat, XP, totaux et statut `terminee`.

Conditions, contrôlées dans cet ordre (le `message` de l'exception est le code) :

| Code                  | Cas                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------ |
| `session_not_found`   | session inconnue, ou session d'un autre utilisateur                                  |
| `session_not_running` | session `abandonnee`, `terminee_sans_photo` (ou `terminee` sans plat)                |
| `session_expired`     | 6 h ou plus depuis `started_at` (R-06)                                               |
| `invalid_photo_path`  | chemin qui n'est pas `{uid}/{session_id}/<fichier>` (ou contient `.` / `..`)         |
| `photo_missing`       | aucun objet à ce chemin dans le bucket `dishes`                                      |
| `too_early`           | moins de max(5 min, 40 % de `recipes.active_min`) depuis `started_at` (R-09)         |
| `duplicate_photo`     | empreinte déjà connue pour cet utilisateur (R-12)                                    |

Hors contrat, en cas de bug du client uniquement : `invalid_photo_sha256` si l'empreinte n'est pas
un SHA-256 hexadécimal (64 caractères, la casse est ignorée) et `not_authenticated` sans session.

Une erreur annule tout l'appel. En particulier, après `session_expired`, la session reste
techniquement `en_cours` jusqu'au prochain `get_active_cook_session` (ou au lancement d'une autre
session), qui la passe en `abandonnee` ; d'ici là, chaque appel renvoie `session_expired`.

Règles appliquées au plat accepté :

- R-11 : au plus 2 plats comptés par jour (heure de Paris), et une même recette comptée une fois
  par jour. Au-delà, le plat est créé avec `counted = false` et 0 XP.
- R-13, R-15 : plat compté = 100 XP, inscrits dans `xp_ledger` ; `profiles.lifetime_xp` et
  `user_weeks` (`dishes_count`, `xp`, `goal_reached_at` au 3e plat compté) sont mis à jour dans la
  même transaction.
- R-14 (défi de la semaine) : pas encore appliqué (tâche 2.5), point d'extension en commentaire.

Résultat :

```json
{
  "dish_id": "uuid",
  "counted": true,
  "xp_awarded": 100,
  "week_start": "2026-10-12",
  "week_dishes_count": 3,
  "goal_reached": true,
  "streak": 1,
  "lifetime_xp": 300,
  "already_completed": false
}
```

**Idempotence (R-10)** : rappelée sur une session déjà validée par le même utilisateur (par exemple
après un échec réseau), la fonction renvoie le même résultat avec `already_completed = true`, sans
rien créer ni rapporter de plus. Le chemin et l'empreinte passés sont alors ignorés. `streak` et
`lifetime_xp` sont les valeurs au moment de l'appel.

## `get_my_progress() returns jsonb` (R-16 à R-18)

```json
{
  "lifetime_xp": 300,
  "week_start": "2026-10-12",
  "week_xp": 300,
  "week_dishes_count": 3,
  "goal": 3,
  "goal_reached": true,
  "streak": 1,
  "today_dishes_count": 1,
  "server_now": "2026-10-15T08:00:00+00:00"
}
```

- `week_dishes_count` ne compte que les plats comptés ; il repart à 0 le lundi à 00:00 (R-18).
- `today_dishes_count` compte tous les plats validés aujourd'hui (heure de Paris), comptés ou non
  (rappel R-29, Pépin `fier` R-30).

## Série (R-17)

`private.streak_for(p_user uuid, p_at timestamptz default now())` : nombre de semaines réussies
(3 plats comptés ou plus dans `user_weeks`) consécutives jusqu'à la semaine dernière, +1 si la
semaine en cours est déjà réussie. La semaine en cours ne casse donc jamais la série avant
dimanche 23:59:59 ; un trou d'une semaine la remet à 0. Calculée à la lecture, sans tâche
planifiée. Utilisée par `complete_cook_session` et `get_my_progress`, et à réutiliser pour le
classement (phase 2) depuis une autre fonction `security definer`.

## Fonctions internes

Le schéma `private` (non exposé par l'API, inaccessible à `anon` et `authenticated`) contient les
variantes paramétrées par l'utilisateur et l'instant : `get_active_cook_session_at`,
`complete_cook_session_at`, `get_my_progress_at`, `streak_for`. Les fonctions publiques ne font que
leur passer `auth.uid()` et `now()`. Les tests pgTAP les appellent directement pour simuler minuit,
le lundi 00:00 et les changements d'heure.

## Côté app : photo et validation (tâche 1.4)

Code : `app/src/features/dishes/`, schémas et textes dans `packages/shared/src/cookResult.ts`.

- Photo prise dans l'app (`expo-camera`, sans galerie ni filtre, R-07), réduite à 1440 px de
  large et compressée en JPEG ; l'empreinte SHA-256 porte sur les octets envoyés (R-12).
- Chemin : `dishes/{uid}/{session}/{sha256}.jpg`. La RLS du stockage n'autorise que l'insertion
  (pas d'écrasement, donc pas d'upsert) : un réessai du même fichier reçoit « existe déjà »
  (409), traité comme un succès ; une autre photo (après `duplicate_photo`) a son propre chemin.
- Un envoi réussi n'est pas refait ; `complete_cook_session` est rappelé tel quel après un échec
  réseau et `already_completed = true` vaut succès (R-10). « Passer » disparaît dès qu'une
  validation a été tentée.
- Après un plat validé, l'app invalide les requêtes TanStack Query de clé `['progress', ...]`
  (`progressKeys` exporté par `app/src/features/dishes`).
