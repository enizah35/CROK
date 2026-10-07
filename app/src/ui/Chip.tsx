import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH } from './tokens';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/** Filtre activable (temps, budget, ustensiles). Sélectionné : fond vert tige + coche. */
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const { colors, radii, spacing } = useTheme();
  const textColor = disabled ? colors.disabledText : selected ? colors.onSecondary : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => [
        styles.base,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.lg,
          backgroundColor: disabled
            ? colors.disabledBackground
            : selected
              ? pressed
                ? colors.secondaryPressed
                : colors.secondary
              : pressed
                ? colors.surfaceAlt
                : colors.surface,
          borderColor: selected && !disabled ? colors.secondary : colors.border,
        },
      ]}
    >
      <Text variant="label" style={{ color: textColor }}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
