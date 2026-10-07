/**
 * Jetons du design system CROK : couleurs (clair / sombre), espacements, rayons, typographie.
 *
 * Identité : chaleureuse et fun, pour des étudiants de 18 à 25 ans. Rouge tomate (Pépin),
 * vert tige, fond crème, accent moutarde. Chaque paire texte / fond utilisée par les
 * composants est vérifiée WCAG AA dans `__tests__/tokens.test.ts`.
 */

export type ColorScheme = 'light' | 'dark';

export type ColorTokens = {
  /** Fond d'écran (crème en clair). */
  background: string;
  /** Fond des cartes et des éléments posés sur l'écran. */
  surface: string;
  /** Fond secondaire (zones en retrait, chips non sélectionnées). */
  surfaceAlt: string;
  text: string;
  textMuted: string;
  /** Contour des composants interactifs (≥ 3:1 avec le fond, WCAG 1.4.11). */
  border: string;
  /** Contour décoratif (cartes) : pas d'exigence de contraste. */
  borderSubtle: string;
  /** Rouge tomate : action principale, texte d'action. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Vert tige : sélection, réussite. */
  secondary: string;
  secondaryPressed: string;
  onSecondary: string;
  /** Moutarde : touches de fête, badges. */
  accent: string;
  onAccent: string;
  danger: string;
  disabledBackground: string;
  disabledText: string;
};

export const palette: Record<ColorScheme, ColorTokens> = {
  light: {
    background: '#FFF8EE',
    surface: '#FFFFFF',
    surfaceAlt: '#FCEFDC',
    text: '#2A1A14',
    textMuted: '#6B5048',
    border: '#8C7468',
    borderSubtle: '#EADBC8',
    primary: '#C8352A',
    primaryPressed: '#A82B20',
    onPrimary: '#FFFFFF',
    secondary: '#2E7D32',
    secondaryPressed: '#1F5E23',
    onSecondary: '#FFFFFF',
    accent: '#F4B63F',
    onAccent: '#2A1A14',
    danger: '#B3261E',
    disabledBackground: '#EADBC8',
    disabledText: '#6B5048',
  },
  dark: {
    background: '#1C1412',
    surface: '#2A201C',
    surfaceAlt: '#3A2C26',
    text: '#FFF3E6',
    textMuted: '#CDB8AC',
    border: '#9C8478',
    borderSubtle: '#4A3A33',
    primary: '#FF6B57',
    primaryPressed: '#FF8F7F',
    onPrimary: '#1C1412',
    secondary: '#7CC47F',
    secondaryPressed: '#9BD49D',
    onSecondary: '#1C1412',
    accent: '#FFC94D',
    onAccent: '#1C1412',
    danger: '#FF8A80',
    disabledBackground: '#3A2C26',
    disabledText: '#CDB8AC',
  },
};

/** Couleurs propres à Pépin : identiques en clair et en sombre (c'est un personnage). */
export const pepinColors = {
  body: '#E5402F',
  bodyShade: '#B92E21',
  highlight: '#FF8A73',
  stem: '#3E9B3A',
  stemDark: '#2A6E27',
  face: '#2A1A14',
  cheek: '#FF9C8C',
  flameOuter: '#FF8A1F',
  flameInner: '#FFD23F',
  hat: '#F4B63F',
  hatStripe: '#2E7D32',
  confetti: ['#F4B63F', '#2E7D32', '#3D7BD9', '#D1382A'],
} as const;

/** 12 fonds d'avatar provisoires (R-32 : avatar parmi 12). Le chiffre prend la couleur la plus lisible. */
export const avatarColors = [
  '#D1382A',
  '#E8743B',
  '#F4B63F',
  '#9CC63F',
  '#2E7D32',
  '#1A7A75',
  '#2F6BC4',
  '#5B4BC4',
  '#9B3FB5',
  '#C23A78',
  '#8C5A3C',
  '#4A5560',
] as const;

export const AVATAR_COUNT = avatarColors.length;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/** Zone tactile minimale (Apple HIG : 44 pt ; Material : 48 dp). */
export const MIN_TOUCH = 44;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;
