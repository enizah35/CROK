/** `pnpm recipes:schema` : régénère content/*.schema.json depuis les schémas Zod de @crok/shared. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTENT_DIR } from './lib/files';
import { renderJsonSchema, SCHEMA_FILES } from './lib/schema-files';

for (const [kind, fileName] of SCHEMA_FILES) {
  writeFileSync(join(CONTENT_DIR, fileName), renderJsonSchema(kind));
  console.log(`✓ content/${fileName}`);
}
