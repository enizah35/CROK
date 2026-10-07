import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { entryHref } from '@/features/auth/accountStatus';
import { useAccountStatus } from '@/features/auth/useAccountStatus';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ErrorState, Screen, Text, useTheme } from '@/ui';

/** Aiguillage selon l'état du compte (garde de navigation, R-32). */
export default function Index() {
  const { status, retry } = useAccountStatus();
  const { colors, spacing } = useTheme();
  const centered = { justifyContent: 'center', alignItems: 'center', gap: spacing.md } as const;

  if (!isSupabaseConfigured) {
    return (
      <Screen contentStyle={centered}>
        <Text variant="title" align="center">
          Configuration manquante
        </Text>
        <Text color="textMuted" align="center">
          Copie .env.example dans app/.env.local et renseigne EXPO_PUBLIC_SUPABASE_URL et
          EXPO_PUBLIC_SUPABASE_ANON_KEY, puis relance l’app.
        </Text>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen contentStyle={centered}>
        <ErrorState
          title="Impossible de charger ton profil"
          message="Vérifie ta connexion et réessaie."
          onRetry={retry}
        />
      </Screen>
    );
  }

  const href = entryHref(status);
  if (href === null) {
    return (
      <Screen contentStyle={centered}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Chargement" />
      </Screen>
    );
  }
  return <Redirect href={href} />;
}
