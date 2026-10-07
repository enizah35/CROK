# Écrire une recette CROK

Ce guide explique comment ajouter une recette à l'app, de la page blanche à la publication.
Compte une quinzaine de minutes par recette une fois l'habitude prise.

## Avant de commencer (une seule fois)

1. Ouvre le dossier du dépôt dans **VS Code**.
2. VS Code propose d'installer l'extension recommandée **YAML** (de Red Hat) : accepte.
   Sinon : onglet Extensions, cherche « YAML Red Hat », installe.
3. Dans un terminal, à la racine du dépôt : `pnpm install`.

Avec l'extension, VS Code t'aide pendant la saisie :

- **Ctrl+Espace** (aussi sur Mac) propose les champs et les valeurs possibles (unités, équipements, rayons…).
- **Survoler un champ** affiche son explication.
- Les erreurs sont **soulignées en rouge** pendant que tu écris.

## Écrire une recette pas à pas

### 1. Copier le modèle

Copie `content/recipes/_modele.yaml` et renomme la copie avec le **slug** de la recette :
minuscules, sans accent, mots séparés par des tirets. Exemple : `gratin-de-courgettes.yaml`.

Le modèle est commenté ligne par ligne : lis-le une fois en entier.

### 2. Remplir l'en-tête

```yaml
slug: gratin-de-courgettes      # = nom du fichier sans .yaml
title: Gratin de courgettes
servings_base: 2                # portions pour lesquelles tu écris les quantités (1 à 6)
total_min: 40                   # durée totale, cuisson comprise
active_min: 15                  # temps où l'on s'active vraiment
cost_cents_per_serving: 140     # en CENTIMES : 1,40 € = 140
equipment: [plaques, four]      # parmi plaques, four, micro_ondes
tags: [vegetarien, gratin]      # facultatif
```

- **Le slug ne change plus** une fois la recette publiée : c'est lui qui relie le fichier à la
  recette dans l'app.
- **Temps actif** : couper, remuer, surveiller. Pas l'eau qui chauffe ni le plat au four.
  Il sert à fixer le délai minimum avant de pouvoir valider le plat (40 % du temps actif,
  5 min au moins).
- **Coût** : prix d'une portion avec des produits de supermarché premier prix ou marque
  distributeur. Au-dessus de 2,50 €, `recipes:check` t'avertit.

### 3. Lister les ingrédients

Dans l'ordre où on les utilise. Chaque ingrédient commence par un tiret, aligné sous
`ingredients:` avec **deux espaces** :

```yaml
ingredients:
  - name: courgette
    quantity: 2
    unit: piece
    category: fruits_legumes
  - name: crème fraîche
    quantity: 20
    unit: cl            # ✗ refusé : voir les unités ci-dessous
```

Astuce : tape `- ` sous `ingredients:` puis Ctrl+Espace, VS Code insère un ingrédient vide.

#### Conventions d'unités

| Unité            | Pour quoi                                   | Exemple                          |
| ---------------- | ------------------------------------------- | -------------------------------- |
| `g`              | tout ce qui se pèse                         | 200 g de pâtes, 30 g de beurre   |
| `ml`             | tout ce qui se verse                        | 400 ml de lait de coco           |
| `piece`          | ce qui se compte                            | 1 oignon, 3 œufs, 2 gousses d'ail |
| `cuillere_soupe` | huile, sauce soja, farine en petite quantité | 1 cuillère à soupe d'huile       |
| `cuillere_cafe`  | épices                                      | 1 cuillère à café de curry       |
| `pincee`         | une pincée                                  | 1 pincée de piment               |
| `au_gout`        | sel, poivre : **sans** `quantity`           | sel                              |

Règles :

- **Pas de kg, de litre ni de cl** : écris `1000 g`, `1000 ml`, `200 ml`. Le recalcul des
  portions arrondit les grammes à 5 près et les pièces à la demi-unité ; tout doit donc être
  dans la même unité.
- **Nombres à virgule avec un point** : `0.5`, pas `0,5`.
- Pour une gousse d'ail, écris `name: gousse d'ail`, `unit: piece`.
- Une quantité qui ne doit **pas** changer avec le nombre de portions (une feuille de laurier,
  un cube de bouillon) : ajoute `non_scalable: true`.
- `category` (le rayon du magasin) est facultatif mais utile pour une future liste de courses :
  `fruits_legumes`, `cremerie`, `viande_poisson`, `feculents`, `conserves`, `epicerie`,
  `epices_condiments`, `surgeles`, `boulangerie`.

### 4. Écrire les étapes

Chaque étape s'affiche **seule sur un écran** en mode cuisine. Une action par étape, à
l'impératif, avec le tutoiement :

```yaml
steps:
  - text: Coupe les courgettes en rondelles fines.
  - text: Fais-les revenir à la poêle avec l'huile.
    timer_sec: 300                # minuteur en SECONDES : 300 = 5 min
    tip: Elles doivent juste dorer, pas ramollir.
```

- `timer_sec` (facultatif) est en **secondes** : 60 = 1 min, 300 = 5 min, 600 = 10 min,
  900 = 15 min, 1200 = 20 min.
- `tip` (facultatif) : une astuce courte affichée sous l'étape.
- Deux plaques en parallèle, c'est normal (le riz d'un côté, la sauce de l'autre) : dis-le
  dans le texte (« Sur la deuxième plaque… »).

### 5. Photo de couverture (facultatif)

Place la photo dans `content/covers/` avec le même nom que le slug
(`gratin-de-courgettes.jpg`), puis ajoute `cover: gratin-de-courgettes.jpg`.

### 6. Brouillon

Tant qu'une recette n'est pas prête, ajoute `published: false` : elle peut être publiée en
base sans apparaître dans l'app.

## Vérifier

```bash
pnpm recipes:check                      # toutes les recettes
pnpm recipes:check gratin-de-courgettes # seulement les fichiers dont le nom contient ce texte
```

Chaque problème s'affiche sur une ligne : `fichier:ligne:colonne  gravité  champ : message`.
Dans le terminal de VS Code, **Ctrl+clic** (Cmd+clic) sur `fichier:ligne` ouvre la bonne ligne.

```
content/recipes/gratin-de-courgettes.yaml:14:11  erreur  ingredients n°2 › unit : unité inconnue : choisis parmi g, ml, … (trouvé : « cl »)
content/recipes/gratin-de-courgettes.yaml:6:25  avertissement  cost_cents_per_serving : 2,80 € par portion : au-dessus de 2,50 €, …
```

- Une **erreur** bloque la publication : corrige-la.
- Un **avertissement** signale une incohérence probable (recette chère, minuteur plus long
  que la recette, temps actif plus long que le total, slug différent du nom du fichier,
  ingrédient en double, four cité sans `four` dans `equipment`…). Il ne bloque pas : à toi de
  juger.
- Les avertissements n'apparaissent qu'une fois les erreurs du fichier corrigées.

Erreurs fréquentes :

| Message                                    | Cause probable                                             |
| ------------------------------------------ | ---------------------------------------------------------- |
| `YAML illisible : tabulation interdite`    | une tabulation au lieu d'espaces                           |
| `YAML illisible : ligne mal indentée…`     | décalage d'espaces, ou `:` oublié après un nom de champ    |
| `champ inconnu « categorie »`              | faute de frappe : le message liste les champs possibles    |
| `nombre à virgule : utilise un point`      | `0,5` au lieu de `0.5`                                     |
| `champ obligatoire manquant`               | une ligne de l'en-tête a été supprimée                     |
| `caractère inattendu`                      | un texte contenant `:` ou `#` : mets-le entre guillemets   |

## Publier

La publication envoie les recettes dans Supabase. Il faut une fois pour toutes :

1. Copier `scripts/.env.example` en `scripts/.env.local` (ce fichier n'est jamais commité).
2. Y mettre `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (tableau de bord Supabase,
   Project Settings › API ; en local, `supabase status`).

> La clé `service_role` donne tous les droits sur la base. Ne la mets **jamais** dans
> `app/.env.local`, ne la préfixe **jamais** par `EXPO_PUBLIC_`, ne la colle nulle part ailleurs.

Ensuite :

```bash
pnpm recipes:push --dry-run   # montre ce qui serait fait, n'écrit rien
pnpm recipes:push             # publie
```

Pour chaque recette, la publication affiche :

- `+ slug : nouvelle recette (version 1)` ;
- `~ slug : modifiée (version 2 → 3)` : le contenu a changé, la version augmente ;
- `= slug : inchangée` : rien n'est réécrit. Relancer la commande sans rien modifier ne
  change donc rien.

La publication refuse de partir s'il reste une erreur dans `content/`. Supprimer un fichier
ne supprime pas la recette en base : la commande la signale (`?`) ; pour la retirer de l'app,
remets le fichier avec `published: false`.

Les photos de couverture ne sont pas encore envoyées par cette commande (seul le nom du
fichier est enregistré).

## Défis de la semaine

Même principe dans `content/challenges/` : copie `_modele.yaml` en `AAAA-MM-JJ.yaml` (date du
lundi). `recipes:check` vérifie que la date est un lundi, qu'il n'y a qu'un défi par semaine
et que les recettes citées existent. La publication des défis n'est pas encore automatisée.

## Pour les développeurs

- Source de vérité du format : `packages/shared/src/content.ts` (schémas Zod).
- Après modification du schéma : `pnpm recipes:schema` régénère `content/*.schema.json`
  (un test échoue si on oublie).
- `pnpm run ci` lance aussi `pnpm recipes:check`.
