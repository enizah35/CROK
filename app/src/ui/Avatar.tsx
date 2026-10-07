import { Pressable, StyleSheet, View } from 'react-native';

import { mostReadable } from './contrast';
import { Text } from './Text';
import { useTheme } from './theme';
import { avatarColors, AVATAR_COUNT, MIN_TOUCH } from './tokens';

export type AvatarProps = {
  /** Identifiant d'avatar de 1 à 12 (R-32). Une valeur hors bornes est ramenée dans [1, 12]. */
  id: number;
  size?: number;
  /** Rend l'avatar sélectionnable (choix à l'onboarding). */
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
};

/** Couleurs de l'avatar n (fond + chiffre le plus lisible). */
export function avatarStyle(id: number): { background: string; foreground: string } {
  const index = Math.min(Math.max(Math.round(id), 1), AVATAR_COUNT) - 1;
  const background = avatarColors[index] ?? avatarColors[0];
  return { background, foreground: mostReadable(background, ['#FFFFFF', '#2A1A14']) };
}

/** Avatar provisoire : un rond coloré numéroté, en attendant de vraies illustrations. */
export function Avatar({ id, size = 48, onPress, selected = false, testID }: AvatarProps) {
  const { colors } = useTheme();
  const { background, foreground } = avatarStyle(id);
  const n = Math.min(Math.max(Math.round(id), 1), AVATAR_COUNT);
  const label = `Avatar ${n}`;

  const disc = (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
    >
      <Text
        variant="bodyStrong"
        style={{ color: foreground, fontSize: Math.round(size * 0.4), lineHeight: size * 0.5 }}
        allowFontScaling={false}
      >
        {String(n)}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        {...(testID ? { testID } : {})}
      >
        {disc}
      </View>
    );
  }

  const ring = 3;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      {...(testID ? { testID } : {})}
      hitSlop={Math.max(0, (MIN_TOUCH - size) / 2)}
      style={[
        styles.ring,
        {
          padding: ring,
          borderRadius: size / 2 + ring * 2,
          borderWidth: ring,
          borderColor: selected ? colors.primary : 'transparent',
        },
      ]}
    >
      {disc}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignSelf: 'flex-start',
  },
});
