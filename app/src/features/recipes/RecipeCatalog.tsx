import { EMPTY_FILTERS, availableTags, filterRecipes, type RecipeFilters } from '@crok/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { useRecipes } from './api';
import { RecipeCard } from './RecipeCard';
import { RecipeFiltersBar } from './RecipeFiltersBar';
import { EmptyState, ErrorState, Screen, Text, useTheme } from '@/ui';

/** L'en-tête des onglets gère déjà la zone sûre du haut. */
const NO_EDGES = [] as const;

/** Onglet Recettes : catalogue des recettes publiées, filtrable (tâche 1.1). */
export function RecipeCatalog() {
  const { colors, spacing } = useTheme();
  const query = useRecipes();
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_FILTERS);

  const recipes = useMemo(() => query.data ?? [], [query.data]);
  const tags = useMemo(() => availableTags(recipes), [recipes]);
  const visible = useMemo(() => filterRecipes(recipes, filters), [recipes, filters]);

  if (query.isPending) {
    return (
      <Screen edges={NO_EDGES} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Chargement des recettes"
          testID="recipes-loading"
        />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen edges={NO_EDGES} contentStyle={{ justifyContent: 'center' }}>
        <ErrorState
          message="Impossible de charger les recettes. Vérifie ta connexion et réessaie."
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </Screen>
    );
  }

  if (recipes.length === 0) {
    return (
      <Screen edges={NO_EDGES} contentStyle={{ justifyContent: 'center' }}>
        <EmptyState
          title="Les recettes arrivent bientôt"
          message="Pépin goûte encore les premières. Repasse un peu plus tard !"
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={NO_EDGES}>
      <FlatList
        data={visible}
        keyExtractor={(recipe) => recipe.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            <Text variant="title">Qu’est-ce qu’on cuisine ?</Text>
            <RecipeFiltersBar filters={filters} onChange={setFilters} tags={tags} />
            <Text color="textMuted" accessibilityLiveRegion="polite" testID="recipes-count">
              {visible.length === 1 ? '1 recette' : `${visible.length} recettes`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune recette avec ces filtres"
            message="Essaie d’en retirer un ou deux, il y a sûrement de quoi te régaler."
            actionLabel="Effacer les filtres"
            onAction={() => setFilters(EMPTY_FILTERS)}
            testID="recipes-empty-filtered"
          />
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => router.push({ pathname: '/recette/[id]', params: { id: item.id } })}
          />
        )}
      />
    </Screen>
  );
}
