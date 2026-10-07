import { formatDuration, formatEuros, tagLabel } from '@crok/shared';
import { View } from 'react-native';

import type { RecipeSummary } from './api';
import { RecipeCover } from './RecipeCover';
import { Card, Text, useTheme } from '@/ui';

type Props = {
  recipe: RecipeSummary;
  onPress: () => void;
};

/** Carte du catalogue : couverture, titre, temps total, coût par portion, tags. */
export function RecipeCard({ recipe, onPress }: Props) {
  const { colors, radii, spacing } = useTheme();
  const duration = formatDuration(recipe.total_min);
  const cost = formatEuros(recipe.cost_cents_per_serving);

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${recipe.title}, ${duration}, ${cost} la portion`}
      accessibilityHint="Ouvre la fiche recette"
      testID={`recipe-card-${recipe.slug}`}
      style={{ gap: spacing.sm }}
    >
      <RecipeCover coverPath={recipe.cover_path} />
      <Text variant="subtitle">{recipe.title}</Text>
      <Text color="textMuted">{`⏱ ${duration} · ${cost} la portion`}</Text>
      {recipe.tags.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {recipe.tags.map((tag) => (
            <View
              key={tag}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text variant="caption" color="textMuted">
                {tagLabel(tag)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
