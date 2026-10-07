import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { progressKeys } from './api';
import { dishesFixture, progressFixture } from './fixtures';
import { ProfileScreen } from './ProfileScreen';
import { TestProviders } from '@/features/recipes/testUtils';
import { supabase } from '@/lib/supabase';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } }, loading: false }),
}));

type Result = { data: unknown; error: unknown };

let mockTables: Record<string, Result>;
const mockCalls: { table: string; method: string; args: unknown[] }[] = [];

/** Faux constructeur de requête supabase-js : chaînable, puis résolu avec le résultat de la table. */
function mockBuilder(table: string) {
  const result = () => Promise.resolve(mockTables[table] ?? { data: null, error: null });
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      result().then(resolve, reject),
    maybeSingle: () => result(),
  };
  for (const method of ['select', 'eq', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      mockCalls.push({ table, method, args });
      return builder;
    };
  }
  return builder;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn((table: string) => mockBuilder(table)),
    auth: { signOut: jest.fn() },
  },
}));

const rpc = supabase.rpc as unknown as jest.Mock;
const signOut = supabase.auth.signOut as unknown as jest.Mock;

let client: QueryClient;
let appStateListeners: ((state: AppStateStatus) => void)[];

beforeEach(() => {
  mockPush.mockReset();
  mockCalls.length = 0;
  mockTables = {
    profiles: { data: { pseudo: 'Lea_2006', avatar_id: 5, adult_confirmed_at: 'x' }, error: null },
    dishes: { data: dishesFixture, error: null },
  };
  rpc.mockReset().mockResolvedValue({ data: progressFixture, error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: AppStateStatus) => void);
    return {
      remove: () => {
        appStateListeners = appStateListeners.filter((l) => l !== listener);
      },
    };
  });
  client = new QueryClient({
    // gcTime infini : pas de minuteur de nettoyage qui survivrait au test.
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});

afterEach(async () => {
  // Laisse les requêtes encore en vol (profil, plats) se résoudre et notifier dans act().
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.restoreAllMocks();
});

async function renderProfile() {
  await render(
    <QueryClientProvider client={client}>
      <TestProviders>
        <ProfileScreen />
      </TestProviders>
    </QueryClientProvider>,
  );
}

describe('ProfileScreen (tâche 1.5)', () => {
  it('affiche exactement les valeurs renvoyées par get_my_progress', async () => {
    await renderProfile();
    expect(await screen.findByTestId('progress-summary')).toBeOnTheScreen();
    expect(rpc).toHaveBeenCalledWith('get_my_progress');
    expect(client.getQueryData(progressKeys.all)).toEqual(progressFixture);

    expect(screen.getByTestId('progress-lifetime-xp')).toHaveTextContent('1 200 XP');
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min: 0, max: 3, now: 2 });
    expect(screen.getByTestId('progress-streak')).toHaveTextContent('4 semaines');
    expect(screen.getByTestId('progress-today')).toHaveTextContent('Aucun plat pour l’instant');
    expect(screen.getByTestId('progress-days-left')).toHaveTextContent(
      'Encore 6 jours cette semaine',
    );
    expect(screen.getByTestId('pepin-motive')).toBeOnTheScreen();
  });

  it('garde pseudo, avatar et déconnexion', async () => {
    await renderProfile();
    expect(await screen.findByTestId('profile-pseudo')).toHaveTextContent('Lea_2006');
    expect(screen.getByLabelText('Avatar 5')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeEnabled(),
    );
  });

  it('montre le chargement tant que le serveur n’a pas répondu', async () => {
    let respond: (value: Result) => void = () => {};
    rpc.mockReturnValue(new Promise<Result>((resolve) => (respond = resolve)));
    await renderProfile();
    expect(screen.getByLabelText('Chargement de ta progression')).toBeOnTheScreen();
    await act(async () => respond({ data: progressFixture, error: null }));
    expect(await screen.findByTestId('progress-summary')).toBeOnTheScreen();
  });

  it('réponse serveur invalide : état d’erreur, puis nouvelle tentative', async () => {
    rpc.mockResolvedValueOnce({ data: { ...progressFixture, streak: 'quatre' }, error: null });
    await renderProfile();
    expect(await screen.findByTestId('progress-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('progress-summary')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('progress-summary')).toBeOnTheScreen();
  });

  it('erreur réseau : état d’erreur', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('fetch failed') });
    await renderProfile();
    expect(await screen.findByTestId('progress-error')).toBeOnTheScreen();
  });

  it('historique : mes derniers plats, filtrés sur moi, du plus récent au plus ancien', async () => {
    await renderProfile();
    expect(await screen.findByTestId('my-dishes-list')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Dahl de lentilles corail, lundi 5 octobre, Compté'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Recette retirée, mercredi 31 décembre 2025, Hors compteur'),
    ).toBeOnTheScreen();
    const dishCalls = mockCalls.filter((c) => c.table === 'dishes');
    expect(dishCalls).toContainEqual({
      table: 'dishes',
      method: 'eq',
      args: ['user_id', 'user-1'],
    });
    expect(dishCalls).toContainEqual({
      table: 'dishes',
      method: 'order',
      args: ['created_at', { ascending: false }],
    });
  });

  it('historique vide : invitation à choisir une recette', async () => {
    mockTables.dishes = { data: [], error: null };
    await renderProfile();
    expect(await screen.findByTestId('my-dishes-empty')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir une recette' }));
    expect(mockPush).toHaveBeenCalledWith('/recettes');
  });

  it('se rafraîchit au retour au premier plan', async () => {
    await renderProfile();
    await screen.findByTestId('progress-summary');
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockResolvedValue({
      data: { ...progressFixture, week_dishes_count: 3, goal_reached: true, today_dishes_count: 1 },
      error: null,
    });
    await act(async () => {
      for (const listener of appStateListeners) listener('active');
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(await screen.findByTestId('pepin-fier')).toBeOnTheScreen();
    expect(screen.getByTestId('progress-today')).toHaveTextContent('1 plat');
  });
});
