/**
 * Lancement d'une cuisson (R-03) : crée la session puis remplace cet écran par le mode cuisine.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { useStartCookSession } from './api';
import { cookErrorMessage } from './errors';
import { MAX_SERVINGS, MIN_SERVINGS } from './scale';
import { Button, ErrorState, Screen, Text, useTheme } from '@/ui';

/** Paramètre de route → portions valides (R-04), sinon null. */
export function parseServings(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= MIN_SERVINGS && n <= MAX_SERVINGS ? n : null;
}

type Props = { recipeId: string | undefined; servings: string | undefined };

export function LaunchScreen({ recipeId, servings: rawServings }: Props) {
  const { colors, spacing } = useTheme();
  const start = useStartCookSession();
  const servings = parseServings(rawServings);
  const valid = recipeId !== undefined && recipeId.length > 0 && servings !== null;
  const launched = useRef(false);

  const { mutate } = start;

  const launch = useCallback(() => {
    if (recipeId === undefined || recipeId.length === 0 || servings === null) return;
    mutate(
      { recipeId, servings },
      { onSuccess: (sessionId) => router.replace(`/cook/${sessionId}`) },
    );
  }, [mutate, recipeId, servings]);

  // Un seul lancement par montage, même si l'effet est rejoué (mode strict).
  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    launch();
  }, [launch]);

  const centered = [styles.centered, { gap: spacing.md }];

  if (!valid) {
    return (
      <Screen contentStyle={centered}>
        <ErrorState
          title="Impossible de lancer la recette"
          message="Il manque la recette ou le nombre de portions (de 1 à 6)."
        />
        <Button label="Retour" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (start.isError) {
    return (
      <Screen contentStyle={centered}>
        <ErrorState
          title="Impossible de lancer la cuisson"
          message={cookErrorMessage(start.error)}
          onRetry={launch}
        />
        <Button label="Retour" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={centered}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement" />
      <Text color="textMuted" align="center">
        On sort les casseroles…
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
