/**
 * `pnpm recipes:check` : vérifie toutes les recettes et tous les défis de `content/`.
 * `pnpm recipes:check riz-saute` : n'affiche que les fichiers dont le chemin contient « riz-saute »
 * (les contrôles croisés, comme les slugs en double, portent toujours sur tout le dossier).
 *
 * Code de sortie 1 s'il reste au moins une erreur ; les avertissements ne bloquent pas.
 */
import { formatIssue } from './lib/check';
import { checkContentDir } from './lib/files';

const filters = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, text: string): string =>
  color ? `\u001b[${code}m${text}\u001b[0m` : text;

const result = checkContentDir();
const matches = (file: string): boolean =>
  filters.length === 0 || filters.some((f) => file.includes(f));
const issues = result.issues.filter((issue) => matches(issue.file));
const errors = issues.filter((issue) => issue.severity === 'erreur');
const warnings = issues.filter((issue) => issue.severity === 'avertissement');

for (const issue of issues) {
  const line = formatIssue(issue);
  console.log(issue.severity === 'erreur' ? paint(31, line) : paint(33, line));
}

const recipes = result.recipes.filter((r) => !r.template && matches(r.file)).length;
const challenges = result.challenges.filter((c) => !c.template && matches(c.file)).length;
const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? 's' : ''}`;
const summary = `${plural(recipes, 'recette')} valide${recipes > 1 ? 's' : ''}, ${plural(challenges, 'défi')} ; ${plural(errors.length, 'erreur')}, ${plural(warnings.length, 'avertissement')}.`;

if (issues.length > 0) console.log('');
if (errors.length > 0) {
  console.log(paint(31, `✗ ${summary}`));
  console.log('Corrige les erreurs ci-dessus (fichier:ligne) puis relance pnpm recipes:check.');
  process.exitCode = 1;
} else {
  console.log(paint(32, `✓ ${summary}`));
}
