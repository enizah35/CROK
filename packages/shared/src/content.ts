/**
 * Format des contenus éditoriaux écrits à la main par Hugo (tâche 0.3) :
 * recettes (`content/recipes/*.yaml`) et défis de la semaine (`content/challenges/*.yaml`).
 *
 * Ces schémas sont la source de vérité : `content/*.schema.json` (autocomplétion dans VS Code)
 * en est généré, `pnpm recipes:check` les applique, `pnpm recipes:push` les envoie dans la
 * table `recipes` (plan technique §2).
 *
 * Les messages d'erreur sont en français et s'adressent à Hugo, pas à un développeur.
 */
import { z } from 'zod';

/** Identifiant en minuscules, chiffres et tirets : `pates-one-pot`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const EQUIPMENT = ['plaques', 'four', 'micro_ondes'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/**
 * Unités autorisées. Pas de kg ni de litre : tout en g et en ml pour que le recalcul des
 * portions (R-04) arrondisse de façon cohérente.
 */
export const UNITS = [
  'g',
  'ml',
  'piece',
  'cuillere_soupe',
  'cuillere_cafe',
  'pincee',
  'au_gout',
] as const;
export type Unit = (typeof UNITS)[number];

/** Rayon du magasin, pour regrouper une future liste de courses. */
export const INGREDIENT_CATEGORIES = [
  'fruits_legumes',
  'cremerie',
  'viande_poisson',
  'feculents',
  'conserves',
  'epicerie',
  'epices_condiments',
  'surgeles',
  'boulangerie',
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

const UNIT_HELP =
  'g, ml, piece, cuillere_soupe, cuillere_cafe, pincee ou au_gout (pas de kg ni de litre : écris 1000 g ou 1000 ml)';

const slugSchema = z.string({ error: 'doit être un texte' }).regex(SLUG_PATTERN, {
  error: 'uniquement des minuscules sans accent, des chiffres et des tirets (ex. « riz-saute »)',
});

export const ingredientSchema = z
  .strictObject({
    name: z
      .string({ error: "le nom de l'ingrédient est obligatoire" })
      .trim()
      .min(2, { error: 'nom trop court' })
      .max(60, { error: 'nom trop long (60 caractères maximum)' })
      .meta({
        description: "Nom de l'ingrédient tel qu'il s'affiche, au singulier ou au pluriel naturel.",
        examples: ['oignon', 'pâtes (spaghetti)', 'lentilles corail'],
      }),
    quantity: z
      .number({ error: 'la quantité doit être un nombre (ex. 200 ou 0.5)' })
      .positive({ error: 'la quantité doit être supérieure à 0' })
      .max(10000, { error: 'quantité trop grande : vérifie l’unité' })
      .optional()
      .meta({
        description:
          'Quantité pour `servings_base` portions. Nombre avec un point décimal (0.5). À omettre seulement avec l’unité `au_gout`.',
      }),
    unit: z.enum(UNITS, { error: `unité inconnue : choisis parmi ${UNIT_HELP}` }).meta({
      description:
        'Unité. g et ml pour tout ce qui se pèse ou se mesure, piece pour ce qui se compte (1 oignon, 2 œufs, 1 gousse d’ail), au_gout pour sel et poivre.',
    }),
    non_scalable: z.boolean({ error: 'écris true ou false' }).optional().meta({
      description:
        'true si la quantité ne doit pas changer avec le nombre de portions (ex. 1 feuille de laurier). Faux par défaut.',
    }),
    category: z
      .enum(INGREDIENT_CATEGORIES, {
        error: `rayon inconnu : choisis parmi ${INGREDIENT_CATEGORIES.join(', ')}`,
      })
      .optional()
      .meta({ description: 'Rayon du magasin (facultatif).' }),
  })
  .superRefine((ingredient, ctx) => {
    if (ingredient.unit === 'au_gout' && ingredient.quantity !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'pas de quantité avec l’unité au_gout : supprime la ligne quantity',
      });
    }
    if (ingredient.unit !== 'au_gout' && ingredient.quantity === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'quantité manquante (ou utilise l’unité au_gout pour sel, poivre…)',
      });
    }
  })
  .meta({
    defaultSnippets: [
      {
        label: 'Ingrédient',
        body: { name: '$1', quantity: 100, unit: 'g' },
      },
    ],
  });
export type Ingredient = z.infer<typeof ingredientSchema>;

export const stepSchema = z
  .strictObject({
    text: z
      .string({ error: "le texte de l'étape est obligatoire" })
      .trim()
      .min(10, { error: 'étape trop courte (10 caractères minimum)' })
      .max(400, { error: 'étape trop longue (400 caractères maximum) : coupe-la en deux' })
      .meta({ description: 'Une seule action, à l’impératif. S’affiche seule sur un écran.' }),
    timer_sec: z
      .number({ error: 'le minuteur est un nombre de secondes (ex. 600 pour 10 min)' })
      .int({ error: 'le minuteur est un nombre entier de secondes (ex. 90)' })
      .min(10, { error: 'minuteur trop court (10 secondes minimum)' })
      .max(4 * 3600, { error: 'minuteur trop long (4 h maximum)' })
      .optional()
      .meta({
        description: 'Minuteur proposé pendant l’étape, en secondes : 300 = 5 min, 600 = 10 min.',
      }),
    tip: z
      .string({ error: "l'astuce doit être un texte" })
      .trim()
      .min(5, { error: 'astuce trop courte' })
      .max(200, { error: 'astuce trop longue (200 caractères maximum)' })
      .optional()
      .meta({ description: 'Astuce facultative affichée sous l’étape.' }),
  })
  .meta({
    defaultSnippets: [{ label: 'Étape', body: { text: '$1' } }],
  });
export type Step = z.infer<typeof stepSchema>;

export const recipeSchema = z
  .strictObject({
    slug: slugSchema
      .min(3, { error: 'slug trop court (3 caractères minimum)' })
      .max(60, { error: 'slug trop long (60 caractères maximum)' })
      .meta({
        description:
          'Identifiant unique, identique au nom du fichier sans .yaml. Ne plus le changer une fois publié.',
        examples: ['pates-one-pot'],
      }),
    title: z
      .string({ error: 'le titre est obligatoire' })
      .trim()
      .min(3, { error: 'titre trop court' })
      .max(80, { error: 'titre trop long (80 caractères maximum)' })
      .meta({ description: 'Titre affiché dans l’app.' }),
    servings_base: z
      .number({ error: 'nombre de portions obligatoire (de 1 à 6)' })
      .int({ error: 'nombre entier de portions' })
      .min(1, { error: 'au moins 1 portion' })
      .max(6, { error: '6 portions maximum (R-04)' })
      .meta({ description: 'Nombre de portions pour lesquelles les quantités sont écrites.' }),
    total_min: z
      .number({ error: 'durée totale obligatoire, en minutes' })
      .int({ error: 'nombre entier de minutes' })
      .min(1, { error: 'au moins 1 minute' })
      .max(300, { error: '300 minutes maximum' })
      .meta({ description: 'Durée totale en minutes, attentes et cuissons comprises.' }),
    active_min: z
      .number({ error: 'temps actif obligatoire, en minutes' })
      .int({ error: 'nombre entier de minutes' })
      .min(1, { error: 'au moins 1 minute' })
      .max(300, { error: '300 minutes maximum' })
      .meta({
        description:
          'Minutes où l’on s’active vraiment (couper, remuer). Sert au délai minimum avant validation du plat (R-09).',
      }),
    cost_cents_per_serving: z
      .number({ error: 'coût par portion obligatoire, en centimes' })
      .int({ error: 'en centimes, nombre entier : 1,20 € s’écrit 120' })
      .min(0, { error: 'le coût ne peut pas être négatif' })
      .max(2000, { error: 'plus de 20 € par portion : as-tu écrit en centimes ? (1,20 € = 120)' })
      .meta({ description: 'Coût estimé par portion, en centimes : 1,20 € = 120.' }),
    equipment: z
      .array(z.enum(EQUIPMENT, { error: 'choisis parmi plaques, four, micro_ondes' }), {
        error: 'liste d’équipements obligatoire (ex. [plaques])',
      })
      .min(1, { error: 'indique au moins un équipement' })
      .refine((list) => new Set(list).size === list.length, {
        error: 'équipement en double',
      })
      .meta({
        description: 'Équipements nécessaires : plaques, four, micro_ondes.',
        uniqueItems: true,
      }),
    tags: z
      .array(slugSchema, { error: 'liste de tags (ex. [vegetarien, express])' })
      .max(8, { error: '8 tags maximum' })
      .refine((list) => new Set(list).size === list.length, { error: 'tag en double' })
      .default([])
      .meta({
        description: 'Mots-clés pour les filtres, en minuscules avec tirets.',
        uniqueItems: true,
        examples: [['vegetarien', 'express', 'batch-cooking']],
      }),
    cover: z
      .string({ error: 'nom du fichier photo (ex. pates-one-pot.jpg)' })
      .regex(/^[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/, {
        error: 'nom de fichier en minuscules terminé par .jpg, .png ou .webp',
      })
      .optional()
      .meta({
        description: 'Photo de couverture : nom du fichier placé dans content/covers/.',
      }),
    published: z
      .boolean({ error: 'écris true ou false' })
      .default(true)
      .meta({ description: 'false pour garder la recette en brouillon (non visible dans l’app).' }),
    ingredients: z
      .array(ingredientSchema, { error: 'liste d’ingrédients obligatoire' })
      .min(1, { error: 'au moins un ingrédient' })
      .max(30, { error: '30 ingrédients maximum' })
      .meta({ description: 'Ingrédients, dans l’ordre d’utilisation.' }),
    steps: z
      .array(stepSchema, { error: 'liste d’étapes obligatoire' })
      .min(1, { error: 'au moins une étape' })
      .max(25, { error: '25 étapes maximum' })
      .meta({ description: 'Étapes du mode cuisine, une par écran (R-05).' }),
  })
  .meta({
    title: 'Recette CROK',
    description: 'Une recette écrite à la main. Guide : docs/RECETTES.md',
  });

/** Recette telle qu'écrite dans le YAML (avant valeurs par défaut). */
export type RecipeInput = z.input<typeof recipeSchema>;
/** Recette validée, valeurs par défaut appliquées. */
export type Recipe = z.output<typeof recipeSchema>;

function isMonday(isoDate: string): boolean {
  // Date calendaire pure, sans heure : aucun fuseau en jeu (R-01).
  const date = new Date(`${isoDate}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1;
}

export const challengeSchema = z
  .strictObject({
    week_start: z
      .string({ error: 'date du lundi obligatoire, au format AAAA-MM-JJ' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'date au format AAAA-MM-JJ (ex. 2026-10-12)' })
      .refine(isMonday, {
        error: 'la semaine commence un lundi (R-02) : cette date n’en est pas un',
      })
      .meta({ description: 'Lundi de la semaine du défi (AAAA-MM-JJ).' }),
    title: z
      .string({ error: 'le titre est obligatoire' })
      .trim()
      .min(3, { error: 'titre trop court' })
      .max(60, { error: 'titre trop long (60 caractères maximum)' }),
    description: z
      .string({ error: 'la description est obligatoire' })
      .trim()
      .min(10, { error: 'description trop courte' })
      .max(300, { error: 'description trop longue (300 caractères maximum)' }),
    eligible_recipes: z
      .array(slugSchema, { error: 'liste des slugs de recettes éligibles' })
      .min(1, { error: 'au moins une recette éligible' })
      .meta({ description: 'Slugs des recettes qui valident le défi (R-27).' }),
    badge_code: z
      .string({ error: 'code du badge obligatoire' })
      .regex(/^[a-z0-9_]+$/, { error: 'minuscules, chiffres et _ uniquement' })
      .meta({ description: 'Code du badge attribué (ex. roi_des_pates).' }),
    bonus_xp: z
      .number({ error: 'nombre d’XP' })
      .int({ error: 'nombre entier' })
      .min(0, { error: 'pas de bonus négatif' })
      .max(500, { error: '500 XP maximum' })
      .default(50)
      .meta({ description: 'Bonus d’XP du défi réussi (50 par défaut, R-14).' }),
  })
  .meta({ title: 'Défi de la semaine CROK' });

export type ChallengeInput = z.input<typeof challengeSchema>;
export type Challenge = z.output<typeof challengeSchema>;

/** Schéma JSON pour l'autocomplétion des YAML (extension YAML de Red Hat, draft-07). */
export function contentJsonSchema(kind: 'recipe' | 'challenge'): Record<string, unknown> {
  const schema = kind === 'recipe' ? recipeSchema : challengeSchema;
  return z.toJSONSchema(schema, { target: 'draft-07', io: 'input', unrepresentable: 'any' });
}
