import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export type ProgressPillProps = {
  /** Plats comptés cette semaine, tel que renvoyé par le serveur (R-16, R-18). */
  count: number;
  /** Objectif de la semaine (R-16 : 3). */
  goal?: number;
  testID?: string;
};

/**
 * Compteur x/3 de la série hebdomadaire. Affichage seul : le calcul est fait par le serveur
 * (R-08, R-15) ; on se contente de borner l'affichage à l'objectif.
 */
export function ProgressPill({ count, goal = 3, testID }: ProgressPillProps) {
  const { colors, radii, spacing } = useTheme();
  const shown = Math.max(0, Math.min(count, goal));
  const done = shown >= goal;
  const label = done
    ? `Objectif de la semaine atteint : ${shown} plats sur ${goal}`
    : `Série de la semaine : ${shown} ${shown > 1 ? 'plats' : 'plat'} sur ${goal}`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: goal, now: shown }}
      {...(testID ? { testID } : {})}
      style={[
        styles.pill,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          backgroundColor: done ? colors.secondary : colors.surfaceAlt,
          borderColor: done ? colors.secondary : colors.border,
        },
      ]}
    >
      <View style={[styles.dots, { gap: spacing.xs }]}>
        {Array.from({ length: goal }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < shown
                ? { backgroundColor: done ? colors.onSecondary : colors.primary }
                : { borderColor: done ? colors.onSecondary : colors.border, borderWidth: 1.5 },
            ]}
          />
        ))}
      </View>
      <Text variant="label" style={{ color: done ? colors.onSecondary : colors.text }}>
        {`${shown}/${goal}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 32,
    borderWidth: 1.5,
  },
  dots: {
    flexDirection: 'row',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
