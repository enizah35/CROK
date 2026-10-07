import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { clearLocalCookState } from './cleanup';
import { emptyProgress, loadProgress, progressKey, saveProgress } from './storage';
import { RECIPE } from './testUtils';
import { startTimer } from './timers';

jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  cancel.mockClear();
});

describe('persistance locale de la cuisson (R-06)', () => {
  it('relit l’étape, les minuteurs et la recette figée', async () => {
    const progress = {
      ...emptyProgress('s1'),
      stepIndex: 2,
      timers: [{ ...startTimer(2, 300, 1000), notificationId: 'n1' }],
      recipe: RECIPE,
    };
    await saveProgress(progress);
    expect(await loadProgress('s1')).toEqual(progress);
    expect(await loadProgress('autre')).toBeNull();
  });

  it('ignore un état illisible', async () => {
    await AsyncStorage.setItem(progressKey('s1'), '{pas du json');
    expect(await loadProgress('s1')).toBeNull();
    await AsyncStorage.setItem(progressKey('s1'), JSON.stringify({ sessionId: 's1' }));
    expect(await loadProgress('s1')).toBeNull();
  });

  it('le ménage efface les autres sessions et annule leurs alertes', async () => {
    await saveProgress({
      ...emptyProgress('vieille'),
      timers: [{ ...startTimer(0, 60, 1000), notificationId: 'n-vieille' }],
    });
    await saveProgress({
      ...emptyProgress('active'),
      timers: [{ ...startTimer(0, 60, 1000), notificationId: 'n-active' }],
    });
    await AsyncStorage.setItem('autre.cle', 'garde-moi');

    await clearLocalCookState('active');
    expect(await loadProgress('vieille')).toBeNull();
    expect(await loadProgress('active')).not.toBeNull();
    expect(cancel).toHaveBeenCalledWith('n-vieille');
    expect(cancel).not.toHaveBeenCalledWith('n-active');
    expect(await AsyncStorage.getItem('autre.cle')).toBe('garde-moi');

    await clearLocalCookState(null);
    expect(await loadProgress('active')).toBeNull();
    expect(cancel).toHaveBeenCalledWith('n-active');
  });
});
