import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from './theme';

export type ScreenProps = {
  children: ReactNode;
  /** Contenu défilant (ScrollView) ou fixe. */
  scroll?: boolean;
  /** Bords protégés par la safe area. Par défaut : haut et bas. */
  edges?: readonly Edge[];
  /** Marges latérales standard (spacing.lg). */
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Conteneur d'écran : fond du thème + safe area. */
export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  padded = true,
  contentStyle,
  testID,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const insetStyle: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  const inner: ViewStyle = padded ? { paddingHorizontal: spacing.lg } : {};

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }, insetStyle]}
      {...(testID ? { testID } : {})}
    >
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[inner, { paddingVertical: spacing.lg }, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, inner, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
