import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkContentDir, CONTENT_DIR } from './files';
import { renderJsonSchema, SCHEMA_FILES } from './schema-files';

describe('contenus du dépôt', () => {
  it('content/ ne contient aucune erreur ni avertissement', () => {
    const result = checkContentDir();
    expect(result.issues).toEqual([]);
    expect(result.recipes.filter((r) => !r.template).length).toBeGreaterThanOrEqual(3);
  });

  it('les exemples sont pas chers et faisables avec deux plaques', () => {
    for (const { recipe, template } of checkContentDir().recipes) {
      if (template) continue;
      expect(recipe.equipment).toEqual(['plaques']);
      expect(recipe.cost_cents_per_serving).toBeLessThanOrEqual(150);
    }
  });

  it.each(SCHEMA_FILES)(
    'content/%s.schema.json est à jour (sinon : pnpm recipes:schema)',
    (kind, fileName) => {
      expect(readFileSync(join(CONTENT_DIR, fileName), 'utf8')).toBe(renderJsonSchema(kind));
    },
  );
});
