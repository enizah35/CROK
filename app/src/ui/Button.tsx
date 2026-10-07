import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { MIN_TOUCH, type ColorTokens } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Par défaut : le libellé. À préciser si le libellé seul est ambigu. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Occupe toute la largeur disponible. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function variantColors(variant: ButtonVariant, colors: ColorTokens, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return {
        background: pressed ? colors.primaryPressed : colors.primary,
        border: 'transparent',
        text: colors.onPrimary,
      };
    case 'secondary':
      return {
        background: pressed ? colors.surfaceAlt : colors.surface,
        border: colors.primary,
        text: colors.primary,
      };
    case 'ghost':
      return {
        background: pressed ? colors.surfaceAlt : 'transparent',
        border: 'transparent',
        text: colors.primary,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  block = false,
  style,
  testID,
}: ButtonProps) {
  const { colors, radii, spacing } = useTheme();
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: inactive, busy: loading }}
      {...(testID ? { testID } : {})}
      style={({ pressed }) => {
        const c = variantColors(variant, colors, pressed && !inactive);
        const isDisabledLook = disabled && !loading;
        return [
          styles.base,
          {
            borderRadius: radii.pill,
            paddingHorizontal: spacing.xl,
            backgroundColor: isDisabledLook
              ? variant === 'ghost'
                ? 'transparent'
                : colors.disabledBackground
              : c.background,
            borderColor: isDisabledLook && variant === 'secondary' ? colors.border : c.border,
          },
          block && styles.block,
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const c = variantColors(variant, colors, pressed);
        const textColor = disabled && !loading ? colors.disabledText : c.text;
        return (
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator
                color={textColor}
                style={{ marginRight: spacing.sm }}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : null}
            <Text variant="bodyStrong" style={{ color: textColor }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: MIN_TOUCH,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  block: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
