/**
 * Notification locale à l'échéance d'un minuteur (R-05).
 *
 * La permission est demandée au premier minuteur lancé. Si elle est refusée (ou si le module
 * est indisponible, sur le web par exemple), le minuteur fonctionne quand même : seule
 * l'alerte hors de l'app manque, et l'écran le signale.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const ANDROID_CHANNEL = 'minuteurs';

let handlerInstalled = false;

/** Affiche aussi la notification quand l'app est au premier plan. */
function installForegroundHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
  });
}

/** Vrai si les notifications sont permises ; demande la permission si elle n'a jamais été posée. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    installForegroundHandler();
    if (Platform.OS === 'android') {
      // Android 13+ : le canal doit exister avant la demande de permission.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Minuteurs de cuisson',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/** Programme l'alerte ; renvoie son identifiant, ou null si impossible (permission refusée…). */
export async function scheduleTimerNotification(
  endsAt: number,
  recipeTitle: string,
  stepNumber: number,
): Promise<string | null> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'C’est l’heure !',
        body: `${recipeTitle} : le minuteur de l’étape ${stepNumber} est terminé.`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: endsAt,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : {}),
      },
    });
  } catch {
    return null;
  }
}

export async function cancelTimerNotification(id: string | null): Promise<void> {
  if (id === null) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Déjà délivrée ou inconnue : rien à faire.
  }
}
