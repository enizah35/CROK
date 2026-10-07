import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from './theme';

type CardBaseProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type CardProps =
  | (CardBaseProps & { onPress?: undefined; accessibilityLabel?: string })
  | (CardBaseProps & {
      /** Carte cliquable : un libellé d'accessibilité est alors obligatoire. */
      onPress: () => void;
      accessibilityLabel: string;
      accessibilityHint?: string;
    });

export function Card(props: CardProps) {
  const { colors, radii, spacing } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  };

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel}
        {...(props.accessibilityHint ? { accessibilityHint: props.accessibilityHint } : {})}
        {...(props.testID ? { testID: props.testID } : {})}
        style={({ pressed }) => [
          base,
          { minHeight: 44 },
          pressed && { backgroundColor: colors.surfaceAlt },
          props.style,
        ]}
      >
        {props.children}
      </Pressable>
    );
  }

  return (
    <View
      style={[base, props.style]}
      {...(props.accessibilityLabel ? { accessibilityLabel: props.accessibilityLabel } : {})}
      {...(props.testID ? { testID: props.testID } : {})}
    >
      {props.children}
    </View>
  );
}
