/**
 * Reprise d'une cuisson au démarrage de l'app (R-06).
 *
 * Monté une fois dans le layout des onglets (premier écran de l'app une fois connecté) : il
 * interroge `get_active_cook_session()` UNE seule fois par montage. Si une session de moins
 * de 6 h (selon l'horloge du serveur) est renvoyée, il propose de la reprendre à la bonne
 * étape ; sinon il efface l'état local des anciennes cuissons.
 */
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { cookKeys, fetchActiveSession } from './api';
import { clearLocalCookState } from './cleanup';
import { resumableSession, resumeWindowRemainingMs, type ActiveSession } from './session';
import { loadProgress, type CookProgress } from './storage';
import { Button, Card, Pepin, Text, useTheme } from '@/ui';

type Offer = { session: ActiveSession; progress: CookProgress | null };

function formatWindow(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function CookResumePrompt() {
  const queryClient = useQueryClient();
  const { colors, spacing } = useTheme();
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const active = await queryClient.fetchQuery({
          queryKey: cookKeys.active,
          queryFn: fetchActiveSession,
          staleTime: 0,
        });
        const session = resumableSession(active);
        // Ménage : tout ce qui n'est pas la session en cours est périmé (R-06).
        await clearLocalCookState(session?.id ?? null);
        if (session === null || cancelled) return;
        const progress = await loadProgress(session.id);
        if (!cancelled) setOffer({ session, progress });
      } catch {
        // Hors ligne au démarrage : on ne propose rien et on ne touche pas à l'état local.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  if (offer === null) return null;

  const { session, progress } = offer;
  const title = progress?.recipe?.title;
  const stepCount = progress?.recipe?.steps.length;
  const stepLine =
    progress && stepCount !== undefined
      ? `Tu en étais à l’étape ${Math.min(progress.stepIndex, stepCount - 1) + 1} sur ${stepCount}.`
      : null;

  return (
    <Modal animationType="slide" visible onRequestClose={() => setOffer(null)}>
      <View style={[styles.sheet, { padding: spacing.lg, backgroundColor: colors.background }]}>
        <Card testID="cook-resume-prompt">
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Pepin etat="motive" taille={96} />
            <Text variant="title" align="center">
              {title ? `${title} t’attend !` : 'Ta cuisson t’attend !'}
            </Text>
            {stepLine ? <Text align="center">{stepLine}</Text> : null}
            <Text color="textMuted" align="center">
              Tu peux la reprendre encore {formatWindow(resumeWindowRemainingMs(session))}.
            </Text>
            <Button
              label="Reprendre"
              block
              onPress={() => {
                setOffer(null);
                router.push(`/cook/${session.id}`);
              }}
            />
            <Button label="Plus tard" variant="ghost" block onPress={() => setOffer(null)} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    justifyContent: 'center',
  },
});
