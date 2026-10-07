import { cancelTimerNotification } from './notifications';
import { listStoredProgress, removeStoredKeys } from './storage';

/**
 * Efface l'état local des cuissons (progression et alertes programmées), sauf celui de
 * `keepSessionId`. Appelé quand le serveur dit qu'aucune session n'est en cours (R-06), au
 * lancement d'une nouvelle session (R-03) et à l'abandon.
 */
export async function clearLocalCookState(keepSessionId: string | null): Promise<void> {
  const stored = await listStoredProgress();
  await Promise.all(
    stored
      .filter((p) => p.sessionId !== keepSessionId)
      .flatMap((p) => p.timers.map((t) => cancelTimerNotification(t.notificationId))),
  );
  await removeStoredKeys(keepSessionId);
}
