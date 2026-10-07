import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { CookScreen } from './CookScreen';
import { emptyProgress, loadProgress, saveProgress } from './storage';
import { RECIPE, T0, activeSession, queryMock, renderApp, type QueryMock } from './testUtils';
import { startTimer } from './timers';

const mockRpc = jest.fn();
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const notif = Notifications as unknown as Record<
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'scheduleNotificationAsync'
  | 'cancelScheduledNotificationAsync',
  jest.Mock
>;
const nav = router as unknown as Record<'push' | 'replace' | 'back', jest.Mock>;

let clock = T0;
let recipeQuery: QueryMock;
let sessionQuery: QueryMock;

function serverReturns(session: ReturnType<typeof activeSession> | null) {
  mockRpc.mockResolvedValue({ data: session, error: null });
}

/** Un montage = un démarrage de l'app : nouveau cache, seul AsyncStorage persiste. */
function launchApp(sessionId = 'session-1') {
  return renderApp(<CookScreen sessionId={sessionId} />);
}

beforeEach(async () => {
  clock = T0 + 10 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  serverReturns(activeSession());
  recipeQuery = queryMock({ data: RECIPE, error: null });
  sessionQuery = queryMock({ data: null, error: null });
  mockFrom.mockImplementation((table: string) =>
    table === 'recipes' ? recipeQuery : sessionQuery,
  );
  notif.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
  notif.requestPermissionsAsync.mockResolvedValue({ granted: true });
  notif.scheduleNotificationAsync.mockResolvedValue('notif-1');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('mode cuisine : navigation des étapes (R-05)', () => {
  it('une étape par écran, navigation libre avant/arrière, puis « C’est prêt ! »', async () => {
    await launchApp();
    expect(await screen.findByText('Émince l’oignon finement.')).toBeTruthy();
    expect(screen.getByTestId('step-counter')).toHaveTextContent('Étape 1 sur 4');
    expect(screen.getByRole('button', { name: 'Précédente' })).toBeDisabled();
    expect(mockRpc).toHaveBeenCalledWith('get_active_cook_session');

    await fireEvent.press(screen.getByRole('button', { name: 'Suivante' }));
    expect(screen.getByTestId('step-counter')).toHaveTextContent('Étape 2 sur 4');
    expect(screen.getByText('Astuce : Couvre pour gagner du temps.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Précédente' }));
    expect(screen.getByTestId('step-counter')).toHaveTextContent('Étape 1 sur 4');

    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByRole('button', { name: 'Suivante' }));
    }
    expect(screen.getByTestId('step-counter')).toHaveTextContent('Étape 4 sur 4');
    expect(screen.queryByRole('button', { name: 'Suivante' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'C’est prêt !' }));
    expect(nav.push).toHaveBeenCalledWith('/cook/photo?session=session-1');
  });

  it('affiche les ingrédients mis à l’échelle et change les portions par UPDATE', async () => {
    await launchApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Voir les ingrédients' }));
    expect(screen.getByTestId('ingredient-0')).toHaveTextContent('200 g pâtes');

    serverReturns(activeSession({ servings: 3 }));
    await fireEvent.press(screen.getByRole('button', { name: 'Une portion de plus' }));
    await waitFor(() =>
      expect(screen.getByTestId('servings-value')).toHaveTextContent('3 portions'),
    );
    expect(screen.getByTestId('ingredient-0')).toHaveTextContent('300 g pâtes');
    expect(screen.getByTestId('ingredient-2')).toHaveTextContent('1 feuille de laurier');
    expect(sessionQuery.update).toHaveBeenCalledWith({ servings: 3 });
    expect(sessionQuery.eq).toHaveBeenCalledWith('id', 'session-1');
  });

  it('abandonne après confirmation (UPDATE abandonnee) et efface l’état local', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await launchApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Suivante' }));
    await waitFor(async () => expect((await loadProgress('session-1'))?.stepIndex).toBe(1));

    await fireEvent.press(screen.getByRole('button', { name: 'Abandonner la cuisson' }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/recettes'));
    expect(sessionQuery.update).toHaveBeenCalledWith({ status: 'abandonnee' });
    expect(await loadProgress('session-1')).toBeNull();
  });

  it('n’abandonne pas si l’on choisit de continuer', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await launchApp();
    await fireEvent.press(await screen.findByRole('button', { name: 'Abandonner la cuisson' }));
    expect(Alert.alert).toHaveBeenCalled();
    expect(sessionQuery.update).not.toHaveBeenCalled();
  });
});

describe('minuteurs (R-05)', () => {
  async function goToTimerStep() {
    await launchApp();
    await screen.findByText('Émince l’oignon finement.');
    await fireEvent.press(screen.getByRole('button', { name: 'Suivante' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Suivante' }));
  }

  it('programme une notification locale à l’heure de fin absolue', async () => {
    await goToTimerStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Lancer le minuteur' }));
    await waitFor(() => expect(notif.scheduleNotificationAsync).toHaveBeenCalled());
    const [request] = notif.scheduleNotificationAsync.mock.calls[0] as [
      { trigger: { date: number } },
    ];
    expect(request.trigger.date).toBe(clock + 300_000);
    expect(screen.getByTestId('timer-remaining')).toHaveTextContent('5:00');
    await waitFor(async () =>
      expect((await loadProgress('session-1'))?.timers[0]?.notificationId).toBe('notif-1'),
    );
  });

  it('demande la permission au premier minuteur et se dégrade proprement si refusée', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    notif.requestPermissionsAsync.mockResolvedValue({ granted: false });
    await goToTimerStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Lancer le minuteur' }));
    expect(
      await screen.findByText(/Notifications désactivées : garde un œil sur l’écran/),
    ).toBeTruthy();
    expect(notif.requestPermissionsAsync).toHaveBeenCalled();
    expect(notif.scheduleNotificationAsync).not.toHaveBeenCalled();
    // Le minuteur tourne quand même.
    expect(screen.getByTestId('timer-remaining')).toHaveTextContent('5:00');
  });

  it('pause : l’alerte est annulée ; reprise : reprogrammée', async () => {
    await goToTimerStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Lancer le minuteur' }));
    await waitFor(async () =>
      expect((await loadProgress('session-1'))?.timers[0]?.notificationId).toBe('notif-1'),
    );
    clock += 60_000;
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
    expect(screen.getByTestId('timer-remaining')).toHaveTextContent('4:00');

    clock += 600_000;
    notif.scheduleNotificationAsync.mockResolvedValue('notif-2');
    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    await waitFor(() => expect(notif.scheduleNotificationAsync).toHaveBeenCalledTimes(2));
    const [request] = notif.scheduleNotificationAsync.mock.calls[1] as [
      { trigger: { date: number } },
    ];
    expect(request.trigger.date).toBe(clock + 240_000);
  });
});

describe('reprise (R-06) : app tuée puis relancée', () => {
  it('la session reprend à la bonne étape avec le minuteur restant', async () => {
    // 1er lancement : étape 3, minuteur de 5 min démarré.
    const first = await launchApp();
    await screen.findByText('Émince l’oignon finement.');
    await fireEvent.press(screen.getByRole('button', { name: 'Suivante' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Suivante' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lancer le minuteur' }));
    await waitFor(async () =>
      expect((await loadProgress('session-1'))?.timers[0]?.notificationId).toBe('notif-1'),
    );

    // L'app est tuée.
    await first.unmount();

    // 2 min plus tard, relance : nouveau cache, la recette a été modifiée entre-temps sur le
    // serveur (version 4) mais la session reste sur la version figée (3) gardée localement.
    clock += 120_000;
    serverReturns(activeSession({ server_now: new Date(clock).toISOString() }));
    recipeQuery = queryMock({ data: { ...RECIPE, version: 4, title: 'Autre' }, error: null });
    mockFrom.mockClear();

    await launchApp();
    expect(await screen.findByText('Laisse cuire à feu moyen en remuant.')).toBeTruthy();
    expect(screen.getByTestId('step-counter')).toHaveTextContent('Étape 3 sur 4');
    expect(screen.getByTestId('timer-remaining')).toHaveTextContent('3:00');
    expect(screen.getByText('Pâtes one pot')).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalledWith('recipes');
  });

  it('un minuteur échu pendant que l’app était fermée s’affiche terminé', async () => {
    await saveProgress({
      ...emptyProgress('session-1'),
      stepIndex: 2,
      timers: [startTimer(2, 300, clock - 400_000)],
      recipe: RECIPE,
    });
    await launchApp();
    expect(await screen.findByText('C’est l’heure !')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Relancer' })).toBeTruthy();
  });

  it('les minuteurs des autres étapes restent visibles et ramènent à leur étape', async () => {
    await saveProgress({
      ...emptyProgress('session-1'),
      stepIndex: 0,
      timers: [startTimer(2, 300, clock - 60_000)],
      recipe: RECIPE,
    });
    await launchApp();
    const chip = await screen.findByRole('button', { name: 'Étape 3 : 4:00' });
    await fireEvent.press(chip);
    expect(screen.getByTestId('step-counter')).toHaveTextContent('Étape 3 sur 4');
  });

  it('session expirée ou close (serveur → null) : écran de fin et état local effacé', async () => {
    await saveProgress({
      ...emptyProgress('session-1'),
      stepIndex: 2,
      timers: [{ ...startTimer(2, 300, clock), notificationId: 'n-old' }],
      recipe: RECIPE,
    });
    serverReturns(null);
    await launchApp();
    expect(await screen.findByText('Cette cuisson est terminée')).toBeTruthy();
    await waitFor(async () => expect(await loadProgress('session-1')).toBeNull());
    expect(notif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('n-old');
    await fireEvent.press(screen.getByRole('button', { name: 'Voir les recettes' }));
    expect(nav.replace).toHaveBeenCalledWith('/recettes');
  });

  it('session de 6 h ou plus selon le serveur : traitée comme expirée', async () => {
    serverReturns(activeSession({ server_now: new Date(T0 + 6 * 3600 * 1000).toISOString() }));
    await launchApp();
    expect(await screen.findByText('Cette cuisson est terminée')).toBeTruthy();
  });

  it('erreur réseau : message clair et nouvel essai', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Network request failed' } });
    await launchApp();
    expect(
      await screen.findByText('Pas de connexion. Vérifie ton réseau et réessaie.'),
    ).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    });
    expect(await screen.findByText('Émince l’oignon finement.')).toBeTruthy();
  });
});
