/** Lecture des contenus sur le disque, chemins relatifs à la racine du dépôt. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { checkContent } from './check';
import type { CheckResult, SourceFile } from './check';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
export const CONTENT_DIR = join(REPO_ROOT, 'content');

function readYamlDir(dir: string): SourceFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => {
      const absolute = join(dir, name);
      return {
        path: relative(REPO_ROOT, absolute).split('\\').join('/'),
        source: readFileSync(absolute, 'utf8'),
      };
    });
}

/** Vérifie tout `content/` (recettes, défis, photos de couverture). */
export function checkContentDir(contentDir: string = CONTENT_DIR): CheckResult {
  return checkContent(
    {
      recipes: readYamlDir(join(contentDir, 'recipes')),
      challenges: readYamlDir(join(contentDir, 'challenges')),
    },
    { coverExists: (fileName) => existsSync(join(contentDir, 'covers', fileName)) },
  );
}
