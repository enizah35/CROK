/**
 * Mode cuisine (R-03 à R-06) : une étape par écran, navigation libre, minuteurs locaux,
 * ingrédients consultables, portions modifiables, reprise après arrêt de l'app.
 */
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { useAbandonSession, useActiveCookSession, useCookRecipe, useUpdateServings } from './api';
import { clearLocalCookState } from './cleanup';
import { cookErrorMessage } from './errors';
import { IngredientsPanel } from './IngredientsPanel';
import { resumableSession, type ActiveSession, type CookRecipe } from './session';
import { StepTimerView } from './StepTimerView';
import { formatRemaining, remainingMs, timerStatus } from './timers';
import { useCookProgress, type CookProgressApi } from './useCookProgress';
import { useNow } from './useNow';
import { Button, EmptyState, ErrorState, Screen, Text, useTheme } from '@/ui';

const RECIPES_HREF = '/recettes';

function Loading() {
  const { colors } = useTheme();
  return (
    <Screen contentStyle={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement" />
    </Screen>
  );
}

export function CookScreen({ sessionId }: { sessionId: string }) {
  const active = useActiveCookSession();

  if (active.isPending) return <Loading />;
  if (active.isError) {
    return (
      <Screen contentStyle={styles.centered}>
        <ErrorState
          title="Impossible de retrouver ta cuisson"
          message={cookErrorMessage(active.error)}
          onRetry={() => void active.refetch()}
          retrying={active.isRefetching}
        />
      </Screen>
    );
  }

  // R-06 : seule la session en cours, de moins de 6 h selon le serveur, se poursuit.
  const session = resumableSession(active.data);
  if (session === null || session.id !== sessionId) {
    return <SessionOver keepSessionId={session?.id ?? null} />;
  }
  return <CookSession session={session} />;
}

/** Session terminée, abandonnée ou expirée : on nettoie l'état local et on propose de repartir. */
function SessionOver({ keepSessionId }: { keepSessionId: string | null }) {
  useEffect(() => {
    void clearLocalCookState(keepSessionId).catch(() => undefined);
  }, [keepSessionId]);

  return (
    <Screen contentStyle={styles.centered}>
      <EmptyState
        title="Cette cuisson est terminée"
        message="Elle a été close ou date de plus de 6 h. Lance une recette quand tu veux !"
        pepin="neutre"
        actionLabel="Voir les recettes"
        onAction={() => router.replace(RECIPES_HREF)}
      />
    </Screen>
  );
}

/** Choisit la recette figée au lancement (copie locale) ou la charge une première fois. */
function CookSession({ session }: { session: ActiveSession }) {
  const api = useCookProgress(session.id);
  const snapshot = api.progress?.recipe ?? null;
  const hasSnapshot = snapshot !== null && snapshot.version === session.recipe_version;
  const recipeQuery = useCookRecipe(
    api.progress !== null && !hasSnapshot ? session.recipe_id : null,
  );
  const { setRecipeSnapshot } = api;
  const recipe = hasSnapshot ? snapshot : (recipeQuery.data ?? null);

  useEffect(() => {
    if (!hasSnapshot && recipeQuery.data) setRecipeSnapshot(recipeQuery.data);
  }, [hasSnapshot, recipeQuery.data, setRecipeSnapshot]);

  if (api.progress === null) return <Loading />;
  if (recipe === null) {
    if (recipeQuery.isError) {
      return (
        <Screen contentStyle={styles.centered}>
          <ErrorState
            title="Impossible de charger la recette"
            message={cookErrorMessage(recipeQuery.error)}
            onRetry={() => void recipeQuery.refetch()}
            retrying={recipeQuery.isRefetching}
          />
        </Screen>
      );
    }
    return <Loading />;
  }
  return <CookSteps session={session} recipe={recipe} api={api} />;
}

type CookStepsProps = { session: ActiveSession; recipe: CookRecipe; api: CookProgressApi };

function CookSteps({ session, recipe, api }: CookStepsProps) {
  // R-05 : écran maintenu allumé pendant toute la cuisson.
  useKeepAwake();
  const { colors, radii, spacing } = useTheme();
  const [showIngredients, setShowIngredients] = useState(false);
  const servingsMutation = useUpdateServings(session.id);
  const abandonMutation = useAbandonSession(session.id);

  const timers = api.progress?.timers ?? [];
  const now = useNow(timers.some((t) => t.endsAt !== null));

  if (api.progress === null) return <Loading />;

  const stepCount = recipe.steps.length;
  const stepIndex = Math.min(api.progress.stepIndex, stepCount - 1);
  const step = recipe.steps[stepIndex];
  if (!step) return <Loading />;
  const isLast = stepIndex === stepCount - 1;
  const timer = timers.find((t) => t.stepIndex === stepIndex);
  const otherTimers = timers
    .filter((t) => t.stepIndex !== stepIndex && timerStatus(t, now) !== 'paused')
    .sort((a, b) => a.stepIndex - b.stepIndex);

  const confirmAbandon = () => {
    Alert.alert(
      'Abandonner la cuisson ?',
      'Ta progression sur cette recette sera perdue. Pas de souci, tu pourras la relancer quand tu veux.',
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () =>
            abandonMutation.mutate(undefined, {
              onSuccess: () => router.replace(RECIPES_HREF),
            }),
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        testID="cook-screen"
      >
        <View style={{ gap: spacing.sm }}>
          <Text variant="subtitle">{recipe.title}</Text>
          <Text color="textMuted" testID="step-counter">
            Étape {stepIndex + 1} sur {stepCount}
          </Text>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Étape ${stepIndex + 1} sur ${stepCount}`}
            accessibilityValue={{ min: 1, max: stepCount, now: stepIndex + 1 }}
            style={[styles.track, { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill }]}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${((stepIndex + 1) / stepCount) * 100}%`,
                  backgroundColor: colors.primary,
                  borderRadius: radii.pill,
                },
              ]}
            />
          </View>
        </View>

        {otherTimers.length > 0 ? (
          <View style={[styles.wrap, { gap: spacing.sm }]}>
            {otherTimers.map((t) => {
              const done = timerStatus(t, now) === 'done';
              const label = done
                ? `Étape ${t.stepIndex + 1} : c’est l’heure !`
                : `Étape ${t.stepIndex + 1} : ${formatRemaining(remainingMs(t, now))}`;
              return (
                <Button
                  key={t.stepIndex}
                  label={label}
                  variant="secondary"
                  accessibilityHint="Aller à cette étape"
                  onPress={() => api.goToStep(t.stepIndex)}
                />
              );
            })}
          </View>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <Text variant="title" testID="step-text">
            {step.text}
          </Text>
          {step.tip ? <Text color="textMuted">Astuce : {step.tip}</Text> : null}
        </View>

        {step.timer_sec !== undefined ? (
          <StepTimerView
            durationSec={step.timer_sec}
            timer={timer}
            now={now}
            onStart={() => api.startStepTimer(stepIndex, step.timer_sec ?? 0, recipe.title)}
            onPause={() => api.pauseStepTimer(stepIndex)}
            onResume={() => api.resumeStepTimer(stepIndex, recipe.title)}
            onReset={() => api.resetStepTimer(stepIndex)}
          />
        ) : null}
        {api.notificationsUnavailable ? (
          <Text color="textMuted" variant="caption">
            Notifications désactivées : garde un œil sur l’écran, le minuteur tourne quand même.
          </Text>
        ) : null}

        <View style={[styles.nav, { gap: spacing.md }]}>
          <Button
            label="Précédente"
            variant="secondary"
            disabled={stepIndex === 0}
            onPress={() => api.goToStep(stepIndex - 1)}
          />
          {isLast ? (
            <Button
              label="C’est prêt !"
              onPress={() => router.push(`/cook/photo?session=${session.id}`)}
            />
          ) : (
            <Button label="Suivante" onPress={() => api.goToStep(stepIndex + 1)} />
          )}
        </View>

        <Button
          label={showIngredients ? 'Masquer les ingrédients' : 'Voir les ingrédients'}
          variant="ghost"
          block
          onPress={() => setShowIngredients((v) => !v)}
        />
        {showIngredients ? (
          <IngredientsPanel
            ingredients={recipe.ingredients}
            servingsBase={recipe.servings_base}
            servings={session.servings}
            changing={servingsMutation.isPending}
            onChangeServings={(n) => servingsMutation.mutate(n)}
          />
        ) : null}
        {servingsMutation.isError ? (
          <Text color="danger" accessibilityRole="alert">
            {cookErrorMessage(servingsMutation.error)}
          </Text>
        ) : null}

        <Button
          label="Abandonner la cuisson"
          variant="ghost"
          block
          loading={abandonMutation.isPending}
          onPress={confirmAbandon}
        />
        {abandonMutation.isError ? (
          <Text color="danger" accessibilityRole="alert">
            {cookErrorMessage(abandonMutation.error)}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
