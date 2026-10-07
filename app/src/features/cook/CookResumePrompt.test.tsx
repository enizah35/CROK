import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { CookResumePrompt } from './CookResumePrompt';
import { emptyProgress, loadProgress, saveProgress } from './storage';
import { RECIPE, T0, activeSession, renderApp } from './testUtils';
import { startTimer } from './timers';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

const push = router.push as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('reprise au démarrage de l’app (R-06)', () => {
  it('propose de reprendre la session en cours à la bonne étape', async () => {
    await saveProgress({ ...emptyProgress('session-1'), stepIndex: 2, recipe: RECIPE });
    await saveProgress({
      ...emptyProgress('ancienne'),
      timers: [{ ...startTimer(0, 60, T0), notificationId: 'n-ancienne' }],
    });
    mockRpc.mockResolvedValue({ data: activeSession(), error: null });

    await renderApp(<CookResumePrompt />);
    expect(await screen.findByText('Pâtes one pot t’attend !')).toBeTruthy();
    expect(screen.getByText('Tu en étais à l’étape 3 sur 4.')).toBeTruthy();
    // 10 min écoulées selon le serveur : il reste 5 h 50.
    expect(screen.getByText('Tu peux la reprendre encore 5 h 50.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_active_cook_session');

    // Les restes d'une autre session sont nettoyés, pas ceux de la session en cours.
    expect(await loadProgress('ancienne')).toBeNull();
    expect(cancel).toHaveBeenCalledWith('n-ancienne');
    expect(await loadProgress('session-1')).not.toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Reprendre' }));
    expect(push).toHaveBeenCalledWith('/cook/session-1');
    expect(screen.queryByTestId('cook-resume-prompt')).toBeNull();
  });

  it('« Plus tard » ferme la proposition sans rien effacer', async () => {
    await saveProgress({ ...emptyProgress('session-1'), stepIndex: 1, recipe: RECIPE });
    mockRpc.mockResolvedValue({ data: activeSession(), error: null });
    await renderApp(<CookResumePrompt />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByTestId('cook-resume-prompt')).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(await loadProgress('session-1')).not.toBeNull();
  });

  it('sans état local, propose quand même de reprendre (à la première étape)', async () => {
    mockRpc.mockResolvedValue({ data: activeSession(), error: null });
    await renderApp(<CookResumePrompt />);
    expect(await screen.findByText('Ta cuisson t’attend !')).toBeTruthy();
  });

  it('serveur → null (session expirée ou close) : rien à proposer, état local effacé', async () => {
    await saveProgress({
      ...emptyProgress('session-1'),
      stepIndex: 2,
      timers: [{ ...startTimer(2, 300, T0), notificationId: 'n1' }],
      recipe: RECIPE,
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    await renderApp(<CookResumePrompt />);
    await waitFor(async () => expect(await loadProgress('session-1')).toBeNull());
    expect(cancel).toHaveBeenCalledWith('n1');
    expect(screen.queryByTestId('cook-resume-prompt')).toBeNull();
  });

  it('se fie à l’horloge du serveur : 6 h écoulées selon lui → pas de reprise', async () => {
    await saveProgress({ ...emptyProgress('session-1'), recipe: RECIPE });
    // Le téléphone retarde (il croit qu'il est T0) mais le serveur dit 6 h après le début.
    const spy = jest.spyOn(Date, 'now').mockReturnValue(T0);
    mockRpc.mockResolvedValue({
      data: activeSession({ server_now: new Date(T0 + 6 * 3600 * 1000).toISOString() }),
      error: null,
    });
    await renderApp(<CookResumePrompt />);
    await waitFor(async () => expect(await loadProgress('session-1')).toBeNull());
    expect(screen.queryByTestId('cook-resume-prompt')).toBeNull();
    spy.mockRestore();
  });

  it('hors ligne au démarrage : ne propose rien et garde l’état local', async () => {
    await saveProgress({ ...emptyProgress('session-1'), recipe: RECIPE });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
    await renderApp(<CookResumePrompt />);
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(await loadProgress('session-1')).not.toBeNull();
    expect(screen.queryByTestId('cook-resume-prompt')).toBeNull();
  });
});
