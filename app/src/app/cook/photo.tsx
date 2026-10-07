// Écran provisoire, remplacé par 1.4 (capture photo, upload, validation, récompense).
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button, Pepin, Screen, Text, useTheme } from '@/ui';

export default function CookPhotoRoute() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  const { spacing } = useTheme();
  return (
    <Screen contentStyle={[styles.centered, { gap: spacing.md }]}>
      <Pepin etat="fier" taille={120} />
      <Text variant="title" align="center">
        Bravo, c’est prêt !
      </Text>
      <Text color="textMuted" align="center">
        La photo de ton plat arrive bientôt (session {session ?? '?'}).
      </Text>
      <Button label="Retour" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
