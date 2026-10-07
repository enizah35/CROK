import { StyleSheet, View } from 'react-native';

import {
  formatDuration,
  formatRemaining,
  remainingMs,
  timerStatus,
  type StepTimer,
} from './timers';
import { Button, Card, Text, useTheme } from '@/ui';

type Props = {
  durationSec: number;
  timer: StepTimer | undefined;
  now: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
};

/** Minuteur de l'étape affichée (R-05). */
export function StepTimerView({
  durationSec,
  timer,
  now,
  onStart,
  onPause,
  onResume,
  onReset,
}: Props) {
  const { spacing } = useTheme();

  if (!timer) {
    return (
      <Card testID="step-timer">
        <View style={[styles.row, { gap: spacing.md }]}>
          <Text variant="subtitle">Minuteur : {formatDuration(durationSec)}</Text>
          <Button label="Lancer le minuteur" onPress={onStart} />
        </View>
      </Card>
    );
  }

  const status = timerStatus(timer, now);
  const remaining = formatRemaining(remainingMs(timer, now));

  return (
    <Card testID="step-timer">
      <View style={[styles.row, { gap: spacing.md }]}>
        {status === 'done' ? (
          <Text variant="title" color="primary" accessibilityLiveRegion="polite">
            C’est l’heure !
          </Text>
        ) : (
          <Text
            variant="display"
            accessibilityRole="timer"
            accessibilityLabel={`Temps restant ${remaining}`}
            testID="timer-remaining"
          >
            {remaining}
          </Text>
        )}
        <View style={[styles.actions, { gap: spacing.sm }]}>
          {status === 'running' ? (
            <Button label="Pause" variant="secondary" onPress={onPause} />
          ) : null}
          {status === 'paused' ? <Button label="Reprendre" onPress={onResume} /> : null}
          <Button
            label={status === 'done' ? 'Relancer' : 'Remettre à zéro'}
            variant="ghost"
            onPress={status === 'done' ? onStart : onReset}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});
