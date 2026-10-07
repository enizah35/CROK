import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Les tests ne doivent jamais dépendre du fuseau de la machine (R-01) : on force un fuseau
    // éloigné de Paris pour détecter tout usage accidentel de l'heure locale.
    env: { TZ: 'America/Los_Angeles' },
  },
});
