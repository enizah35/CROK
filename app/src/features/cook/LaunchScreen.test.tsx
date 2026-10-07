import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LaunchScreen, parseServings } from './LaunchScreen';
import { emptyProgress, loadProgress, saveProgress } from './storage';
import { queryMock, renderApp, type QueryMock } from './testUtils';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
}));

const replace = router.replace as jest.Mock;
let insertQuery: QueryMock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  insertQuery = queryMock({ data: { id: 'nouvelle' }, error: null });
  mockFrom.mockReturnValue(insertQuery);
});

describe('lancement d’une cuisson (R-03)', () => {
  it('crée la session par INSERT puis ouvre le mode cuisine à sa place', async () => {
    await saveProgress({ ...emptyProgress('precedente'), stepIndex: 3 });
    await renderApp(<LaunchScreen recipeId="recipe-1" servings="3" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cook/nouvelle'));
    expect(mockFrom).toHaveBeenCalledWith('cook_sessions');
    // Seules les colonnes accordées au client ; le trigger pose le reste.
    expect(insertQuery.insert).toHaveBeenCalledWith({ recipe_id: 'recipe-1', servings: 3 });
    expect(insertQuery.insert).toHaveBeenCalledTimes(1);
    // La session précédente est abandonnée par le serveur : son état local disparaît.
    expect(await loadProgress('precedente')).toBeNull();
  });

  it('affiche une erreur claire et permet de réessayer', async () => {
    insertQuery = queryMock({ data: null, error: { code: 'P0002', message: 'introuvable' } });
    mockFrom.mockReturnValue(insertQuery);
    await renderApp(<LaunchScreen recipeId="recipe-1" servings="2" />);
    expect(await screen.findByText('Cette recette n’est plus disponible.')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();

    insertQuery = queryMock({ data: { id: 'nouvelle' }, error: null });
    mockFrom.mockReturnValue(insertQuery);
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cook/nouvelle'));
  });

  it('refuse des paramètres invalides sans rien insérer', async () => {
    await renderApp(<LaunchScreen recipeId="recipe-1" servings="9" />);
    expect(await screen.findByText('Impossible de lancer la recette')).toBeTruthy();
    expect(mockFrom).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('valide les portions (R-04 : 1 à 6)', () => {
    expect(parseServings('1')).toBe(1);
    expect(parseServings('6')).toBe(6);
    expect(parseServings('0')).toBeNull();
    expect(parseServings('7')).toBeNull();
    expect(parseServings('2.5')).toBeNull();
    expect(parseServings(undefined)).toBeNull();
  });
});
