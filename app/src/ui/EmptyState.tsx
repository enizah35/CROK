import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Pepin, type PepinEtat } from './Pepin';
import { Text } from './Text';
import { useTheme } from './theme';

export type EmptyStateProps = {
  title: string;
  message?: string;
  pepin?: PepinEtat;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/** Écran ou liste vide : Pépin, un titre, un message et une action facultative. */
export function EmptyState({
  title,
  message,
  pepin = 'neutre',
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <View
      style={[styles.container, { padding: spacing.xl, gap: spacing.md }]}
      {...(testID ? { testID } : {})}
    >
      <Pepin etat={pepin} taille={120} />
      <Text variant="subtitle" align="center">
        {title}
      </Text>
      {message ? (
        <Text color="textMuted" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          style={{ marginTop: spacing.sm, alignSelf: 'center' }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
