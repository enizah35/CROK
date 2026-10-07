import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from './theme';
import type { ColorTokens, TypographyVariant } from './tokens';

type TextColor = keyof Pick<
  ColorTokens,
  'text' | 'textMuted' | 'primary' | 'secondary' | 'danger' | 'onPrimary'
>;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: 'auto' | 'left' | 'center' | 'right';
};

const headingVariants: readonly TypographyVariant[] = ['display', 'title', 'subtitle'];

/** Texte du design system. Les variantes de titre sont annoncées comme titres (role header). */
export function Text({
  variant = 'body',
  color = 'text',
  align = 'auto',
  style,
  accessibilityRole,
  ...rest
}: TextProps) {
  const { colors, typography } = useTheme();
  const role = accessibilityRole ?? (headingVariants.includes(variant) ? 'header' : undefined);
  return (
    <RNText
      {...rest}
      {...(role ? { accessibilityRole: role } : {})}
      style={[typography[variant], { color: colors[color], textAlign: align }, style]}
    />
  );
}
