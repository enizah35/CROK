import { NOT_COUNTED_MESSAGE, rewardPepinEtat, streakLabel, type CookResult } from '@crok/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Button, Card, Pepin, ProgressPill, Screen, Text, useTheme } from '@/ui';

/** « +100 XP » qui apparaît en rebondissant. */
function XpBurst({ xp }: { xp: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.spring(progress, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const [scale] = useState(() =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  );
  return (
    <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>
      <Text
        variant="display"
        color="primary"
        align="center"
        accessibilityLabel={`Plus ${xp} XP`}
        testID="reward-xp"
      >
        {`+${xp} XP`}
      </Text>
    </Animated.View>
  );
}

/**
 * Écran de récompense (R-13, R-16, R-17) : affiche uniquement ce que renvoie
 * `complete_cook_session`, sans rien recalculer (R-08).
 */
export function RewardView({ result }: { result: CookResult }) {
  const { spacing } = useTheme();
  const counted = result.counted && result.xp_awarded > 0;

  return (
    <Screen scroll contentStyle={[styles.content, { gap: spacing.lg }]} testID="reward-screen">
      <Pepin etat={rewardPepinEtat(result)} taille={140} />
      <Text variant="title" align="center">
        {counted ? 'Plat validé, bravo !' : 'Plat enregistré !'}
      </Text>
      {counted ? (
        <XpBurst xp={result.xp_awarded} />
      ) : (
        <Text color="textMuted" align="center" testID="reward-not-counted">
          {NOT_COUNTED_MESSAGE}
        </Text>
      )}

      <Card style={[styles.card, { gap: spacing.md }]}>
        <Text variant="subtitle">Cette semaine</Text>
        <ProgressPill count={result.week_dishes_count} goal={3} testID="reward-week" />
        {result.goal_reached ? (
          <Text color="secondary" variant="bodyStrong">
            Objectif de la semaine atteint, tu es en feu !
          </Text>
        ) : null}
        <Text testID="reward-streak">{streakLabel(result.streak)}</Text>
        <Text color="textMuted" testID="reward-total">
          {`Total : ${result.lifetime_xp} XP`}
        </Text>
      </Card>

      <View style={[styles.actions, { gap: spacing.sm }]}>
        <Button label="Voir mon profil" block onPress={() => router.replace('/profil')} />
        <Button
          label="Voir les recettes"
          variant="secondary"
          block
          onPress={() => router.replace('/recettes')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  card: {
    alignSelf: 'stretch',
  },
  actions: {
    alignSelf: 'stretch',
  },
});
