// @ts-check
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.expo/**',
    '**/web-build/**',
    'app/ios/**',
    'app/android/**',
    'app/expo-env.d.ts',
  ]),

  // Règles TypeScript strictes pour tout le dépôt : pas de `any`, sous aucune forme.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.strict],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // App Expo : règles React / React Native / imports fournies par Expo.
  {
    files: ['app/**/*.{js,jsx,ts,tsx}'],
    extends: [expoConfig],
    settings: {
      'import/resolver': {
        typescript: { project: 'app/tsconfig.json' },
      },
    },
  },

  // Doit rester en dernier : désactive les règles de style gérées par Prettier.
  prettierConfig,
]);
