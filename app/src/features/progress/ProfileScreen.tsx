import { parseServerInstant } from '@crok/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useMyDishes, useMyProgress } from './api';
import { MyDishesList } from './MyDishesList';
import { ProgressSummary } from './ProgressSummary';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyProfile } from '@/features/auth/queries';
import { supabase } from '@/lib/supabase';
import { Avatar, Button, ErrorState, Screen, Text, useTheme } from '@/ui';

/** L'en-tête des onglets gère déjà la zone sûre du haut, la barre d'onglets celle du bas. */
const NO_EDGES = [] as const;

function Loading({ label, testID }: { label: string; testID: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator
        size="large"
        color={colors.primary}
        accessibilityLabel={label}
        testID={testID}
      />
    </View>
  );
}

/** Onglet Profil : identité, progression (tâche 1.5), historique des plats, déconnexion. */
export function ProfileScreen() {
  const queryClient = useQueryClient();
  const { spacing } = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const profile = useMyProfile(userId);
  const progress = useMyProgress();
  const dishes = useMyDishes(userId);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    // scope 'local' : ferme la session de ce téléphone ; elle est effacée du trousseau même
    // si le serveur ne répond pas.
    await supabase.auth.signOut({ scope: 'local' });
    queryClient.clear();
    setBusy(false);
  }

  const currentYear = progress.data
    ? parseServerInstant(progress.data.server_now).getUTCFullYear()
    : undefined;

  return (
    <Screen scroll edges={NO_EDGES} contentStyle={{ gap: spacing.xl }} testID="profile-screen">
      {profile.data ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar id={profile.data.avatar_id ?? 1} size={56} testID="profile-avatar" />
          <Text variant="title" testID="profile-pseudo">
            {profile.data.pseudo ?? ''}
          </Text>
        </View>
      ) : null}

      {progress.isPending ? (
        <Loading label="Chargement de ta progression" testID="progress-loading" />
      ) : progress.isError ? (
        <ErrorState
          testID="progress-error"
          message="Impossible de charger ta progression. Vérifie ta connexion et réessaie."
          onRetry={() => void progress.refetch()}
          retrying={progress.isRefetching}
        />
      ) : (
        <ProgressSummary progress={progress.data} />
      )}

      <View style={{ gap: spacing.md }}>
        <Text variant="subtitle">Mes plats</Text>
        {dishes.isPending ? (
          <Loading label="Chargement de tes plats" testID="my-dishes-loading" />
        ) : dishes.isError ? (
          <ErrorState
            testID="my-dishes-error"
            message="Impossible de charger tes plats. Vérifie ta connexion et réessaie."
            onRetry={() => void dishes.refetch()}
            retrying={dishes.isRefetching}
          />
        ) : (
          <MyDishesList
            dishes={dishes.data}
            {...(currentYear !== undefined ? { currentYear } : {})}
            onBrowseRecipes={() => router.push('/recettes')}
          />
        )}
      </View>

      <Button
        label="Se déconnecter"
        variant="secondary"
        onPress={() => void signOut()}
        loading={busy}
        style={{ alignSelf: 'center' }}
      />
    </Screen>
  );
}
