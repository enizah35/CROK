import { contentJsonSchema } from '@crok/shared';

export const SCHEMA_FILES = [
  ['recipe', 'recipe.schema.json'],
  ['challenge', 'challenge.schema.json'],
] as const;

export function renderJsonSchema(kind: 'recipe' | 'challenge'): string {
  return `${JSON.stringify(contentJsonSchema(kind), null, 2)}\n`;
}
