/**
 * Outils de test du mode cuisine : faux client Supabase (requêtes chaînables) et données.
 * Utilisé uniquement par les tests Jest.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { ActiveSession, CookRecipe } from './session';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Un rendu = un démarrage de l'app : cache neuf ; seul le stockage local (mocké) persiste. */
export async function renderApp(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
  );
}

type Result = { data: unknown; error: unknown };

/** Requête chaînable : `.select().eq().single()` ou `await ….eq()` renvoient `result`. */
export type QueryMock = {
  select: jest.Mock;
  eq: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  single: jest.Mock;
  then: (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
};

export function queryMock(result: Result): QueryMock {
  const q = {} as QueryMock;
  q.select = jest.fn(() => q);
  q.eq = jest.fn(() => q);
  q.insert = jest.fn(() => q);
  q.update = jest.fn(() => q);
  q.single = jest.fn(() => Promise.resolve(result));
  q.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return q;
}

export const RECIPE: CookRecipe = {
  id: 'recipe-1',
  version: 3,
  title: 'Pâtes one pot',
  servings_base: 2,
  ingredients: [
    { name: 'pâtes', quantity: 200, unit: 'g' },
    { name: 'oignon', quantity: 1, unit: 'piece' },
    { name: 'feuille de laurier', quantity: 1, unit: 'piece', non_scalable: true },
    { name: 'sel', unit: 'au_gout' },
  ],
  steps: [
    { text: 'Émince l’oignon finement.' },
    { text: 'Mets tout dans la casserole avec l’eau.', tip: 'Couvre pour gagner du temps.' },
    { text: 'Laisse cuire à feu moyen en remuant.', timer_sec: 300 },
    { text: 'Goûte, sale et sers bien chaud.' },
  ],
};

export const T0 = Date.parse('2026-10-07T18:00:00Z');

export function activeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    id: 'session-1',
    recipe_id: RECIPE.id,
    recipe_version: RECIPE.version,
    servings: 2,
    started_at: new Date(T0).toISOString(),
    server_now: new Date(T0 + 10 * 60 * 1000).toISOString(),
    ...overrides,
  };
}
