import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { palette, radii, spacing, typography, type ColorScheme, type ColorTokens } from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
};

const ForcedSchemeContext = createContext<ColorScheme | null>(null);

type ThemeProviderProps = {
  /** Force un mode (catalogue, tests). Sans valeur : suit le réglage du téléphone. */
  scheme?: ColorScheme | null;
  children: ReactNode;
};

export function ThemeProvider({ scheme = null, children }: ThemeProviderProps) {
  return <ForcedSchemeContext.Provider value={scheme}>{children}</ForcedSchemeContext.Provider>;
}

export function useTheme(): Theme {
  const forced = useContext(ForcedSchemeContext);
  const system = useColorScheme();
  const scheme: ColorScheme = forced ?? (system === 'dark' ? 'dark' : 'light');
  return useMemo(() => ({ scheme, colors: palette[scheme], spacing, radii, typography }), [scheme]);
}
