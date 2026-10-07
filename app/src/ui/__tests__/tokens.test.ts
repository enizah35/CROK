import { avatarStyle } from '../Avatar';
import { contrastRatio } from '../contrast';
import { AVATAR_COUNT, palette, type ColorScheme, type ColorTokens } from '../tokens';

const AA_TEXT = 4.5;
const AA_UI = 3;

type Pair = [fg: keyof ColorTokens, bg: keyof ColorTokens, min: number];

// Toutes les paires réellement utilisées par les composants du kit.
const pairs: Pair[] = [
  ['text', 'background', AA_TEXT],
  ['text', 'surface', AA_TEXT],
  ['text', 'surfaceAlt', AA_TEXT],
  ['textMuted', 'background', AA_TEXT],
  ['textMuted', 'surface', AA_TEXT],
  ['textMuted', 'surfaceAlt', AA_TEXT],
  ['primary', 'background', AA_TEXT],
  ['primary', 'surface', AA_TEXT],
  ['primary', 'surfaceAlt', AA_TEXT],
  ['onPrimary', 'primary', AA_TEXT],
  ['onPrimary', 'primaryPressed', AA_TEXT],
  ['secondary', 'background', AA_TEXT],
  ['secondary', 'surface', AA_TEXT],
  ['onSecondary', 'secondary', AA_TEXT],
  ['onSecondary', 'secondaryPressed', AA_TEXT],
  ['onAccent', 'accent', AA_TEXT],
  ['danger', 'background', AA_TEXT],
  ['danger', 'surface', AA_TEXT],
  ['disabledText', 'disabledBackground', AA_TEXT],
  // Contours de composants interactifs (WCAG 1.4.11).
  ['border', 'background', AA_UI],
  ['border', 'surface', AA_UI],
  ['border', 'surfaceAlt', AA_UI],
  ['primary', 'background', AA_UI],
];

describe('contraste de la palette (WCAG AA)', () => {
  it('calcule les rapports de référence', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  describe.each(['light', 'dark'] as ColorScheme[])('mode %s', (scheme) => {
    it.each(pairs)('%s sur %s ≥ %d', (fg, bg, min) => {
      expect(contrastRatio(palette[scheme][fg], palette[scheme][bg])).toBeGreaterThanOrEqual(min);
    });
  });

  it('chiffre lisible sur chacun des 12 avatars', () => {
    for (let id = 1; id <= AVATAR_COUNT; id++) {
      const { background, foreground } = avatarStyle(id);
      expect(contrastRatio(background, foreground)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
