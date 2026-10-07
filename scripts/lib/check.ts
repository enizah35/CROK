/**
 * Vérification des contenus YAML (recettes et défis) : erreurs et avertissements en français,
 * chacun rattaché à un fichier et à une ligne.
 *
 * Logique pure (aucun accès disque) : les fichiers sont passés en mémoire, ce qui permet de la
 * tester avec Vitest. Le script `recipes-check.ts` s'occupe de lire le disque et d'afficher.
 */
import { challengeSchema, recipeSchema } from '@crok/shared';
import type { Challenge, Recipe } from '@crok/shared';
import { isMap, isNode, isPair, isScalar, LineCounter, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import { z } from 'zod';

export type Severity = 'erreur' | 'avertissement';

export interface Issue {
  file: string;
  /** Ligne (à partir de 1), quand on sait la situer. */
  line?: number;
  column?: number;
  severity: Severity;
  /** Champ concerné, lisible : `ingredients n°3 › unit`. */
  field?: string;
  message: string;
}

export type ContentKind = 'recipe' | 'challenge';

export interface SourceFile {
  /** Chemin relatif à la racine du dépôt, ex. `content/recipes/riz-saute.yaml`. */
  path: string;
  source: string;
}

export interface CheckedRecipe {
  file: string;
  recipe: Recipe;
  /** Fichier modèle (`_modele.yaml`) : vérifié mais jamais publié. */
  template: boolean;
}

export interface CheckResult {
  recipes: CheckedRecipe[];
  challenges: { file: string; challenge: Challenge; template: boolean }[];
  issues: Issue[];
}

export interface CheckOptions {
  /** Indique si une photo de couverture existe dans `content/covers/`. */
  coverExists?: (fileName: string) => boolean;
}

/** Seuil de l'avertissement « recette chère » : 2,50 € par portion. */
export const COST_WARNING_CENTS = 250;

/** Les messages par défaut de Zod (rares : nos schémas ont leurs propres messages) en français. */
const frenchErrorMap = z.locales.fr().localeError;

type PathSegment = string | number;

function baseName(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path;
  return name.replace(/\.ya?ml$/, '');
}

export function isTemplateFile(path: string): boolean {
  return baseName(path).startsWith('_');
}

/** `['ingredients', 2, 'unit']` → `ingredients n°3 › unit` (numérotation humaine). */
export function formatPath(path: readonly PathSegment[]): string {
  return path
    .map((segment) => (typeof segment === 'number' ? `n°${segment + 1}` : segment))
    .join(' › ')
    .replace(/ › n°/g, ' n°');
}

/** Position d'un nœud YAML, ou du nœud existant le plus proche si le chemin n'existe pas. */
class Locator {
  constructor(
    private readonly doc: Document,
    private readonly lines: LineCounter,
  ) {}

  private position(offset: number): { line: number; column: number } {
    const { line, col } = this.lines.linePos(offset);
    return { line, column: col };
  }

  node(path: readonly PathSegment[]): { line: number; column: number } | undefined {
    for (let depth = path.length; depth >= 0; depth -= 1) {
      const found: unknown =
        depth === 0 ? this.doc.contents : this.doc.getIn(path.slice(0, depth), true);
      if (isNode(found) && found.range) return this.position(found.range[0]);
    }
    return undefined;
  }

  /** Position d'une clé dans une table (pour signaler un champ inconnu sur sa propre ligne). */
  key(path: readonly PathSegment[], key: string): { line: number; column: number } | undefined {
    const parent: unknown = path.length === 0 ? this.doc.contents : this.doc.getIn(path, true);
    if (isMap(parent)) {
      for (const item of parent.items) {
        if (isPair(item) && isScalar(item.key) && item.key.value === key && item.key.range) {
          return this.position(item.key.range[0]);
        }
      }
    }
    return this.node(path);
  }
}

function describeInput(input: unknown): string {
  if (input === null) return 'vide';
  if (typeof input === 'string') return `« ${input} »`;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  if (Array.isArray(input)) return 'une liste';
  return 'un bloc';
}

/** Traduit une erreur Zod en message pour Hugo (cas fréquents de saisie YAML). */
function zodMessage(issue: z.core.$ZodIssue, allowedKeys: readonly string[]): string {
  if (issue.code === 'invalid_type') {
    const input: unknown = issue.input;
    if (input === undefined) {
      const field = issue.path[issue.path.length - 1];
      return typeof field === 'string'
        ? `champ obligatoire manquant : ajoute une ligne « ${field}: … »`
        : `élément manquant (${issue.message})`;
    }
    if (input === null) return `valeur vide : ${issue.message}`;
    if (issue.expected === 'number' && typeof input === 'string' && /^\d+,\d+$/.test(input)) {
      return `nombre à virgule : utilise un point (${input.replace(',', '.')})`;
    }
    if (issue.expected === 'number' && typeof input === 'string' && /\d/.test(input)) {
      return `${describeInput(input)} n'est pas un nombre seul : mets l'unité dans le champ unit`;
    }
    return `${issue.message} (trouvé : ${describeInput(input)})`;
  }
  if (issue.code === 'unrecognized_keys') {
    const keys = issue.keys.map((key) => `« ${key} »`).join(', ');
    return `champ inconnu ${keys} : faute de frappe ? Champs possibles ici : ${allowedKeys.join(', ')}`;
  }
  if (issue.code === 'invalid_value' && issue.input !== undefined) {
    return `${issue.message} (trouvé : ${describeInput(issue.input)})`;
  }
  return issue.message;
}

/** Clés autorisées à l'endroit d'une erreur `unrecognized_keys`. */
function allowedKeysAt(kind: ContentKind, path: readonly PathSegment[]): string[] {
  if (kind === 'challenge') return Object.keys(challengeSchema.shape);
  const parent = path.find((segment) => typeof segment === 'string');
  if (path.length === 0) return Object.keys(recipeSchema.shape);
  if (parent === 'ingredients') return ['name', 'quantity', 'unit', 'non_scalable', 'category'];
  if (parent === 'steps') return ['text', 'timer_sec', 'tip'];
  return [];
}

interface ParsedFile<T> {
  value?: T;
  issues: Issue[];
  locator?: Locator;
}

function parseFile<T>(file: SourceFile, kind: ContentKind): ParsedFile<T> {
  const lines = new LineCounter();
  const doc = parseDocument(file.source, {
    lineCounter: lines,
    prettyErrors: true,
    uniqueKeys: true,
  });
  const issues: Issue[] = [];

  const seenLines = new Set<number>();
  for (const error of doc.errors) {
    const pos = error.linePos?.[0];
    // Une faute de syntaxe produit souvent plusieurs erreurs sur la même ligne : on garde la première.
    if (pos) {
      if (seenLines.has(pos.line)) continue;
      seenLines.add(pos.line);
    }
    issues.push({
      file: file.path,
      ...(pos ? { line: pos.line, column: pos.col } : {}),
      severity: 'erreur',
      message: `YAML illisible : ${yamlErrorHint(error.code, error.message)}`,
    });
  }
  if (issues.length > 0) return { issues };

  const locator = new Locator(doc, lines);
  const data: unknown = doc.toJS();
  if (data === null || data === undefined) {
    return { issues: [{ file: file.path, line: 1, severity: 'erreur', message: 'fichier vide' }] };
  }

  const schema = kind === 'recipe' ? recipeSchema : challengeSchema;
  const result = schema.safeParse(data, { reportInput: true, error: frenchErrorMap });
  if (result.success) return { value: result.data as T, issues, locator };

  for (const issue of result.error.issues) {
    const path = issue.path.filter(
      (segment): segment is PathSegment => typeof segment !== 'symbol',
    );
    const pos =
      issue.code === 'unrecognized_keys' && issue.keys[0] !== undefined
        ? locator.key(path, issue.keys[0])
        : locator.node(path);
    issues.push({
      file: file.path,
      ...(pos ?? {}),
      severity: 'erreur',
      ...(path.length > 0 ? { field: formatPath(path) } : {}),
      message: zodMessage(issue, allowedKeysAt(kind, path)),
    });
  }
  return { issues, locator };
}

const YAML_HINTS: Record<string, string> = {
  DUPLICATE_KEY: 'champ écrit deux fois dans le même bloc',
  TAB_AS_INDENT: 'tabulation interdite : indente avec des espaces',
  BAD_INDENT: 'indentation incorrecte : aligne les lignes avec des espaces (2 par niveau)',
  MULTILINE_IMPLICIT_KEY: 'ligne mal indentée ou « : » manquant après un nom de champ',
  BLOCK_AS_IMPLICIT_KEY: 'ligne mal indentée ou « : » manquant après un nom de champ',
  MISSING_CHAR: 'caractère manquant (guillemet, crochet ou « : » ?)',
  UNEXPECTED_TOKEN:
    'caractère inattendu : un texte contenant « : » ou « # » doit être entre guillemets',
  BAD_SCALAR_START:
    'valeur mal commencée : un texte qui commence par un caractère spécial doit être entre guillemets',
};

function yamlErrorHint(code: string, message: string): string {
  // Le message de la bibliothèque YAML répète la position : on la retire.
  const detail = (message.split('\n')[0] ?? message).replace(/ at line \d+, column \d+:?$/, '');
  const hint = YAML_HINTS[code];
  return hint ? `${hint} (${detail})` : detail;
}

/** Avertissements propres à une recette valide (incohérences probables, pas des erreurs). */
function recipeWarnings(
  file: string,
  recipe: Recipe,
  locator: Locator,
  options: CheckOptions,
): Issue[] {
  const warnings: Issue[] = [];
  const warn = (path: PathSegment[], message: string): void => {
    warnings.push({
      file,
      ...(locator.node(path) ?? {}),
      severity: 'avertissement',
      field: formatPath(path),
      message,
    });
  };
  const euros = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

  if (recipe.cost_cents_per_serving > COST_WARNING_CENTS) {
    warn(
      ['cost_cents_per_serving'],
      `${euros(recipe.cost_cents_per_serving)} par portion : au-dessus de ${euros(COST_WARNING_CENTS)}, la recette sort de la promesse « pas cher »`,
    );
  }
  if (recipe.active_min > recipe.total_min) {
    warn(
      ['active_min'],
      `temps actif (${recipe.active_min} min) plus long que la durée totale (${recipe.total_min} min) : inverse-les ?`,
    );
  }

  // Pas de contrôle sur la somme des minuteurs : avec deux plaques, des étapes tournent en parallèle.
  recipe.steps.forEach((step, index) => {
    if (step.timer_sec !== undefined && step.timer_sec > recipe.total_min * 60) {
      warn(
        ['steps', index, 'timer_sec'],
        `minuteur de ${Math.round(step.timer_sec / 60)} min plus long que la durée totale (${recipe.total_min} min) : timer_sec est en secondes (10 min = 600)`,
      );
    }
  });

  const seen = new Map<string, number>();
  recipe.ingredients.forEach((ingredient, index) => {
    const key = ingredient.name.toLocaleLowerCase('fr');
    const first = seen.get(key);
    if (first !== undefined) {
      warn(
        ['ingredients', index, 'name'],
        `« ${ingredient.name} » apparaît deux fois (déjà en n°${first + 1}) : additionne les quantités ?`,
      );
    } else {
      seen.set(key, index);
    }
  });

  const allText = recipe.steps.map((step) => step.text.toLocaleLowerCase('fr')).join('\n');
  if (/\bau four\b|\bpréchauffe/.test(allText) && !recipe.equipment.includes('four')) {
    warn(['equipment'], 'les étapes parlent du four mais equipment ne contient pas « four »');
  }
  if (/micro-ondes|micro ondes/.test(allText) && !recipe.equipment.includes('micro_ondes')) {
    warn(
      ['equipment'],
      'les étapes parlent du micro-ondes mais equipment ne contient pas « micro_ondes »',
    );
  }

  if (recipe.cover !== undefined && options.coverExists && !options.coverExists(recipe.cover)) {
    warn(['cover'], `photo introuvable : ajoute le fichier content/covers/${recipe.cover}`);
  }
  return warnings;
}

/**
 * Vérifie un lot de fichiers. Les contrôles croisés (slugs en double, recettes citées par un
 * défi) portent sur le lot entier : passer tous les fichiers de `content/`.
 */
export function checkContent(
  files: { recipes: SourceFile[]; challenges: SourceFile[] },
  options: CheckOptions = {},
): CheckResult {
  const result: CheckResult = { recipes: [], challenges: [], issues: [] };
  const slugOwners = new Map<string, string>();

  for (const file of files.recipes) {
    const parsed = parseFile<Recipe>(file, 'recipe');
    result.issues.push(...parsed.issues);
    if (!parsed.value || !parsed.locator) continue;
    const recipe = parsed.value;
    const template = isTemplateFile(file.path);
    result.recipes.push({ file: file.path, recipe, template });
    result.issues.push(...recipeWarnings(file.path, recipe, parsed.locator, options));
    if (template) continue;

    const slugPos = parsed.locator.node(['slug']) ?? {};
    if (recipe.slug !== baseName(file.path)) {
      result.issues.push({
        file: file.path,
        ...slugPos,
        severity: 'avertissement',
        field: 'slug',
        message: `le slug « ${recipe.slug} » ne correspond pas au nom du fichier : renomme le fichier en ${recipe.slug}.yaml`,
      });
    }
    const owner = slugOwners.get(recipe.slug);
    if (owner !== undefined) {
      // Erreur et non simple avertissement : la publication écraserait l'une des deux recettes.
      result.issues.push({
        file: file.path,
        ...slugPos,
        severity: 'erreur',
        field: 'slug',
        message: `slug « ${recipe.slug} » déjà utilisé par ${owner} : la publication écraserait l'une des deux recettes`,
      });
    } else {
      slugOwners.set(recipe.slug, file.path);
    }
  }

  const weeks = new Map<string, string>();
  for (const file of files.challenges) {
    const parsed = parseFile<Challenge>(file, 'challenge');
    result.issues.push(...parsed.issues);
    if (!parsed.value || !parsed.locator) continue;
    const challenge = parsed.value;
    const template = isTemplateFile(file.path);
    result.challenges.push({ file: file.path, challenge, template });
    if (template) continue;

    const locator = parsed.locator;
    challenge.eligible_recipes.forEach((slug, index) => {
      if (!slugOwners.has(slug)) {
        result.issues.push({
          file: file.path,
          ...(locator.node(['eligible_recipes', index]) ?? {}),
          severity: 'erreur',
          field: formatPath(['eligible_recipes', index]),
          message: `aucune recette avec le slug « ${slug} » dans content/recipes/`,
        });
      }
    });
    const owner = weeks.get(challenge.week_start);
    if (owner !== undefined) {
      result.issues.push({
        file: file.path,
        ...(locator.node(['week_start']) ?? {}),
        severity: 'erreur',
        field: 'week_start',
        message: `un défi existe déjà pour la semaine du ${challenge.week_start} (${owner}) : un seul défi par semaine`,
      });
    } else {
      weeks.set(challenge.week_start, file.path);
    }
  }

  result.issues.sort((a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
  return result;
}

/** Une ligne par problème, au format `fichier:ligne:colonne` cliquable dans VS Code. */
export function formatIssue(issue: Issue): string {
  const location = [issue.file, issue.line, issue.column]
    .filter((part) => part !== undefined)
    .join(':');
  const field = issue.field ? `${issue.field} : ` : '';
  return `${location}  ${issue.severity}  ${field}${issue.message}`;
}
