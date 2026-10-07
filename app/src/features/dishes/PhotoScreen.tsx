import { SKIPPED_MESSAGE, type CookErrorView } from '@crok/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { Button, Card, EmptyState, ErrorState, Pepin, Screen, Text, radii, useTheme } from '@/ui';

import { RewardView } from './RewardView';
import { useDishSubmission, type CapturedPhoto } from './useDishSubmission';

const goToRecipes = () => router.replace('/recettes');

/**
 * Photo du plat après la dernière étape (R-07) : appareil photo dans l'app, sans galerie ni
 * filtre ; « Passer » termine la session sans XP. Puis envoi, validation serveur (R-08 à R-12)
 * et écran de récompense.
 */
export function PhotoScreen({ sessionId }: { sessionId: string | undefined }) {
  const { session } = useAuth();
  const userId = session?.user.id;

  if (!sessionId || !userId) {
    return (
      <Screen>
        <ErrorState
          title="Session introuvable"
          message="On ne retrouve pas ta session de cuisine. Relance la recette pour valider ton plat."
          onRetry={goToRecipes}
          retryLabel="Voir les recettes"
        />
      </Screen>
    );
  }
  return <PhotoFlow sessionId={sessionId} userId={userId} />;
}

function PhotoFlow({ sessionId, userId }: { sessionId: string; userId: string }) {
  const { spacing } = useTheme();
  const { state, submit, skip, clearError, completionAttempted } = useDishSubmission(
    sessionId,
    userId,
  );
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  if (state.phase === 'done') return <RewardView result={state.result} />;
  if (state.phase === 'skipped') {
    return (
      <Screen contentStyle={styles.centered}>
        <EmptyState
          title="Plat terminé, sans photo"
          message={SKIPPED_MESSAGE}
          actionLabel="Voir les recettes"
          onAction={goToRecipes}
          testID="skipped-screen"
        />
      </Screen>
    );
  }

  const submitting = state.phase === 'submitting';
  const skipping = state.phase === 'skipping';
  // Après une tentative de validation, « Passer » est retiré : la validation a peut-être
  // abouti côté serveur, seul un nouvel essai le dira sans risque (R-10).
  const canSkip = !completionAttempted && !submitting;

  const skipButton = canSkip ? (
    <Button
      label="Passer"
      variant="ghost"
      loading={skipping}
      onPress={() => void skip()}
      accessibilityHint="Sans photo, ce plat ne compte pas pour ta série"
      style={styles.center}
    />
  ) : null;

  return (
    <Screen scroll contentStyle={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Montre-nous ton plat !</Text>
        <Text color="textMuted">
          Une photo prise maintenant, sans filtre : c’est elle qui valide ton plat.
        </Text>
      </View>

      {photo ? (
        <View style={{ gap: spacing.md }}>
          <Image
            source={{ uri: photo.uri }}
            style={styles.frame}
            accessibilityRole="image"
            accessibilityLabel="Aperçu de la photo de ton plat"
            testID="photo-preview"
          />
          {state.phase === 'error' ? (
            <SubmitErrorCard
              error={state.error}
              onRetry={() => void submit(photo)}
              onRetake={() => {
                clearError();
                setPhoto(null);
              }}
            />
          ) : (
            <Button
              label="Valider mon plat"
              block
              loading={submitting}
              onPress={() => void submit(photo)}
            />
          )}
          {!submitting && state.phase !== 'error' ? (
            <Button
              label="Reprendre la photo"
              variant="secondary"
              block
              onPress={() => setPhoto(null)}
            />
          ) : null}
        </View>
      ) : (
        <CameraCapture onCapture={setPhoto} />
      )}

      {state.phase === 'skip_error' ? (
        <Text color="danger" align="center" accessibilityRole="alert">
          Impossible de passer pour l’instant. Vérifie ta connexion et réessaie.
        </Text>
      ) : null}
      {skipButton}
    </Screen>
  );
}

function SubmitErrorCard({
  error,
  onRetry,
  onRetake,
}: {
  error: CookErrorView;
  onRetry: () => void;
  onRetake: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }} testID="submit-error">
      <Text variant="subtitle" accessibilityRole="alert">
        {error.title}
      </Text>
      <Text color="textMuted">{error.message}</Text>
      {error.action === 'retry' ? <Button label="Réessayer" block onPress={onRetry} /> : null}
      {error.action === 'retake' ? (
        <Button label="Reprendre une photo" block onPress={onRetake} />
      ) : null}
      {error.action === 'leave' ? (
        <Button label="Voir les recettes" block onPress={goToRecipes} />
      ) : null}
    </Card>
  );
}

/** Appareil photo intégré, avec gestion de la permission. */
function CameraCapture({ onCapture }: { onCapture: (photo: CapturedPhoto) => void }) {
  const { colors, spacing } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const capturing = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!permission) {
    return (
      <View style={[styles.frame, styles.centered, { backgroundColor: colors.surfaceAlt }]}>
        <ActivityIndicator
          color={colors.primary}
          accessibilityLabel="Ouverture de l’appareil photo"
        />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <Card style={[styles.centered, { gap: spacing.md }]} testID="camera-permission">
        <Pepin etat="neutre" taille={96} />
        <Text variant="subtitle" align="center">
          L’appareil photo est nécessaire
        </Text>
        <Text color="textMuted" align="center">
          {permission.canAskAgain
            ? 'Pour valider ton plat, on a besoin d’une photo prise dans l’app. Elle reste visible par toi et tes amis seulement.'
            : 'L’accès à l’appareil photo est coupé. Tu peux le réactiver dans les réglages de ton téléphone, ou passer pour cette fois.'}
        </Text>
        {permission.canAskAgain ? (
          <Button label="Autoriser l’appareil photo" onPress={() => void requestPermission()} />
        ) : (
          <Button label="Ouvrir les réglages" onPress={() => void Linking.openSettings()} />
        )}
      </Card>
    );
  }

  async function takePicture() {
    if (capturing.current || !camera.current) return;
    capturing.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.9 });
      onCapture({ uri: picture.uri, width: picture.width });
    } catch {
      setFailed(true);
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.frame, { backgroundColor: colors.surfaceAlt }]}>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => setReady(true)}
          testID="camera"
        />
      </View>
      {failed ? (
        <Text color="danger" align="center" accessibilityRole="alert">
          La photo n’a pas pu être prise. Réessaie.
        </Text>
      ) : null}
      <Button
        label="Prendre la photo"
        block
        loading={busy}
        disabled={!ready}
        onPress={() => void takePicture()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignSelf: 'center',
  },
});
