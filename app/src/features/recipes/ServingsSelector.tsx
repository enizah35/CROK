import { MAX_SERVINGS, MIN_SERVINGS } from '@crok/shared';
import { View } from 'react-native';

import { Button, Text, useTheme } from '@/ui';

type Props = {
  value: number;
  onChange: (servings: number) => void;
};

export function servingsLabel(servings: number): string {
  return servings === 1 ? '1 portion' : `${servings} portions`;
}

/** Sélecteur de portions de 1 à 6 (R-04). */
export function ServingsSelector({ value, onChange }: Props) {
  const { spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Button
        variant="secondary"
        label="−"
        accessibilityLabel="Une portion de moins"
        disabled={value <= MIN_SERVINGS}
        onPress={() => onChange(value - 1)}
      />
      <Text
        variant="subtitle"
        testID="servings-value"
        accessibilityLiveRegion="polite"
        style={{ minWidth: 100 }}
        align="center"
      >
        {servingsLabel(value)}
      </Text>
      <Button
        variant="secondary"
        label="+"
        accessibilityLabel="Une portion de plus"
        disabled={value >= MAX_SERVINGS}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}
