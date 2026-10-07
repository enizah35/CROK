import {
  EQUIPMENT_LABELS,
  clampServings,
  formatDuration,
  formatEuros,
  formatQuantity,
  isEquipment,
  scaleIngredients,
  tagLabel,
} from '@crok/shared';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useRecipe, type RecipeDetail } from './api';
import { RecipeCover } from './RecipeCover';
import { ServingsSelector } from './ServingsSelector';
import { Button, EmptyState, ErrorState, Screen, Text, useTheme } from '@/ui';

type Props = { id: string };

/** Fiche recette (tâche 1.1) : infos, portions (R-04), ingrédients, aperçu des étapes. */
export function RecipeDetailScreen({ id }: Props) {
  const { colors } = useTheme();
  const query = useRecipe(id);
  const title = query.data?.title ?? '';

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerBackTitle: 'Recettes',
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
      }}
    />
  );

  if (query.isPending) {
    return (
      <Screen edges={['bottom']} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
        {header}
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Chargement de la recette"
        />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen edges={['bottom']} contentStyle={{ justifyContent: 'center' }}>
        {header}
        <ErrorState
          message="Impossible de charger cette recette. Vérifie ta connexion et réessaie."
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </Screen>
    );
  }

  if (!query.data) {
    return (
      <Screen edges={['bottom']} contentStyle={{ justifyContent: 'center' }}>
        {header}
        <EmptyState
          title="Recette introuvable"
          message="Elle a peut-être été retirée du menu. Il y en a plein d’autres !"
          actionLabel="Voir les recettes"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <>
      {header}
      <RecipeDetailContent recipe={query.data} />
    </>
  );
}

export function RecipeDetailContent({ recipe }: { recipe: RecipeDetail }) {
  const { spacing } = useTheme();
  const [servings, setServings] = useState(() => clampServings(recipe.servings_base));
  const ingredients = useMemo(
    () => scaleIngredients(recipe.ingredients, recipe.servings_base, servings),
    [recipe.ingredients, recipe.servings_base, servings],
  );
  const equipment = recipe.equipment
    .filter(isEquipment)
    .map((item) => EQUIPMENT_LABELS[item])
    .join(', ');

  function cook() {
    // Route créée par la tâche 1.2 (mode cuisine) : elle crée la cook_session (R-03).
    router.push({
      pathname: '/cook/lancer',
      params: { recipeId: recipe.id, servings: String(servings) },
    });
  }

  return (
    <Screen scroll edges={['bottom']} contentStyle={{ gap: spacing.xl }}>
      <RecipeCover coverPath={recipe.cover_path} height={180} />

      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{recipe.title}</Text>
        <Text color="textMuted">
          {`⏱ ${formatDuration(recipe.total_min)} (dont ${formatDuration(recipe.active_min)} à t’activer)`}
        </Text>
        <Text color="textMuted">{`${formatEuros(recipe.cost_cents_per_serving)} la portion`}</Text>
        {equipment ? <Text color="textMuted">{`Il te faut : ${equipment}`}</Text> : null}
        {recipe.tags.length > 0 ? (
          <Text color="textMuted">{recipe.tags.map(tagLabel).join(' · ')}</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="subtitle">Pour combien ?</Text>
        <ServingsSelector value={servings} onChange={setServings} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="subtitle">Ingrédients</Text>
        {ingredients.map((ingredient, index) => {
          const quantity = formatQuantity(ingredient.quantity, ingredient.unit);
          return (
            <View
              key={`${ingredient.name}-${index}`}
              style={{ flexDirection: 'row', gap: spacing.md }}
              accessible
              accessibilityLabel={`${quantity} ${ingredient.name}`}
              testID={`ingredient-${index}`}
            >
              <Text
                variant="bodyStrong"
                style={{ minWidth: 110 }}
                testID={`ingredient-qty-${index}`}
              >
                {quantity}
              </Text>
              <Text style={{ flex: 1 }}>{ingredient.name}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="subtitle">
          {recipe.steps.length === 1 ? 'Les étapes (1)' : `Les étapes (${recipe.steps.length})`}
        </Text>
        {recipe.steps.map((step, index) => (
          <Text key={index} color="textMuted" numberOfLines={2}>
            {`${index + 1}. ${step.text}`}
          </Text>
        ))}
      </View>

      <Button
        block
        label="Cuisiner"
        accessibilityHint={`Lance le mode cuisine pour ${servings} ${servings === 1 ? 'portion' : 'portions'}`}
        onPress={cook}
        testID="cook-button"
      />
    </Screen>
  );
}
