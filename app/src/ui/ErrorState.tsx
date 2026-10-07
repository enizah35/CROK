import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Pepin } from './Pepin';
import { Text } from './Text';
import { useTheme } from './theme';

export type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Pendant une nouvelle tentative. */
  retrying?: boolean;
  testID?: string;
};

/** Erreur (réseau, serveur) : ton léger, sans culpabiliser, avec un bouton pour réessayer. */
export function ErrorState({
  title = 'Oups, un petit pépin',
  message = 'Quelque chose a coincé. Vérifie ta connexion et réessaie.',
  onRetry,
  retryLabel = 'Réessayer',
  retrying = false,
  testID,
}: ErrorStateProps) {
  const { spacing } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, { padding: spacing.xl, gap: spacing.md }]}
      {...(testID ? { testID } : {})}
    >
      <Pepin etat="neutre" taille={120} accessibilityLabel="Pépin la tomate, un peu perdu" />
      <Text variant="subtitle" align="center" accessibilityRole="alert">
        {title}
      </Text>
      <Text color="textMuted" align="center">
        {message}
      </Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          loading={retrying}
          variant="secondary"
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
