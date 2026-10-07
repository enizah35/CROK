import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  formatQuantity,
  scaleIngredients,
  type Ingredient,
} from '@crok/shared';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text, useTheme } from '@/ui';

type Props = {
  ingredients: readonly Ingredient[];
  servingsBase: number;
  servings: number;
  onChangeServings: (servings: number) => void;
  changing: boolean;
};

/** Ingrédients mis à l'échelle (R-04) et choix des portions. */
export function IngredientsPanel({
  ingredients,
  servingsBase,
  servings,
  onChangeServings,
  changing,
}: Props) {
  const { spacing } = useTheme();
  const scaled = scaleIngredients(ingredients, servingsBase, servings);
  const servingsLabel = `${servings} ${servings > 1 ? 'portions' : 'portion'}`;

  return (
    <Card testID="ingredients-panel">
      <View style={[styles.servings, { gap: spacing.sm, marginBottom: spacing.md }]}>
        <Button
          label="−"
          variant="secondary"
          accessibilityLabel="Une portion de moins"
          disabled={changing || servings <= MIN_SERVINGS}
          onPress={() => onChangeServings(servings - 1)}
        />
        <Text variant="subtitle" accessibilityLiveRegion="polite" testID="servings-value">
          {servingsLabel}
        </Text>
        <Button
          label="+"
          variant="secondary"
          accessibilityLabel="Une portion de plus"
          disabled={changing || servings >= MAX_SERVINGS}
          onPress={() => onChangeServings(servings + 1)}
        />
      </View>
      <View style={{ gap: spacing.xs }}>
        {scaled.map((ingredient, index) => {
          const toTaste = ingredient.unit === 'au_gout' || ingredient.quantity === undefined;
          const quantity = toTaste ? '' : formatQuantity(ingredient.quantity, ingredient.unit);
          const suffix = toTaste ? ' (au goût)' : '';
          return (
            <Text key={`${ingredient.name}-${index}`} testID={`ingredient-${index}`}>
              {quantity ? <Text variant="bodyStrong">{quantity} </Text> : null}
              {ingredient.name}
              {suffix}
            </Text>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  servings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
