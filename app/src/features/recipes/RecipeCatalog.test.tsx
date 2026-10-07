import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { RecipeSummary } from './api';
import { summaries } from './fixtures';
import { RecipeCatalog } from './RecipeCatalog';
import { TestProviders } from './testUtils';

const mockPush = jest.fn();
const mockRefetch = jest.fn();

type QueryState = {
  data: RecipeSummary[] | undefined;
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: () => void;
};

let mockQuery: QueryState;

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('./api', () => ({
  useRecipes: () => mockQuery,
}));

// FlatList planifie des rendus par minuteur : on les déroule dans act() en fin de test.
beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockReset();
  mockRefetch.mockReset();
  mockQuery = {
    data: summaries,
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
  };
});

afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

async function renderCatalog() {
  await render(
    <TestProviders>
      <RecipeCatalog />
    </TestProviders>,
  );
}

const visibleTitles = () =>
  screen
    .queryAllByRole('button', { name: /la portion$/ })
    .map((card) => card.props.accessibilityLabel as string)
    .map((label) => label.split(',')[0]);

describe('RecipeCatalog', () => {
  it('liste les recettes avec temps, coût par portion et tags', async () => {
    await renderCatalog();
    expect(visibleTitles()).toEqual([
      'Dahl de lentilles corail',
      'Gratin dauphinois',
      'Mug cake chocolat',
    ]);
    expect(screen.getByText('⏱ 35\u00a0min · 1,10\u00a0€ la portion')).toBeOnTheScreen();
    expect(screen.getByText('⏱ 1\u00a0h\u00a010 · 1,40\u00a0€ la portion')).toBeOnTheScreen();
    expect(screen.getAllByText('Végétarien').length).toBeGreaterThan(0);
    expect(screen.getByTestId('recipes-count')).toHaveTextContent('3 recettes');
  });

  it('filtre par temps, puis désélectionne', async () => {
    await renderCatalog();
    const chip = screen.getByRole('checkbox', { name: '30 minutes maximum' });
    await fireEvent.press(chip);
    expect(chip).toBeChecked();
    expect(visibleTitles()).toEqual(['Mug cake chocolat']);
    await fireEvent.press(chip);
    expect(visibleTitles()).toHaveLength(3);
  });

  it('combine budget, équipement et tags', async () => {
    await renderCatalog();
    await fireEvent.press(
      screen.getByRole('checkbox', { name: '1,50\u00a0€ maximum par portion' }),
    );
    expect(visibleTitles()).toHaveLength(3);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Plaques' }));
    expect(visibleTitles()).toEqual(['Dahl de lentilles corail']);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Four' }));
    expect(visibleTitles()).toEqual(['Dahl de lentilles corail', 'Gratin dauphinois']);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Vegan' }));
    expect(visibleTitles()).toEqual(['Dahl de lentilles corail']);
    expect(screen.getByTestId('recipes-count')).toHaveTextContent('1 recette');
  });

  it('aucun résultat : message et bouton pour effacer les filtres', async () => {
    await renderCatalog();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Micro-ondes' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Vegan' }));
    expect(screen.getByText('Aucune recette avec ces filtres')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(visibleTitles()).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Vegan' })).not.toBeChecked();
  });

  it('bouton « Effacer les n filtres » quand des filtres sont actifs', async () => {
    await renderCatalog();
    expect(screen.queryByRole('button', { name: /^Effacer/ })).toBeNull();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Four' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Plaques' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Effacer les 2 filtres' }));
    expect(screen.getByRole('checkbox', { name: 'Four' })).not.toBeChecked();
  });

  it('ouvre la fiche recette', async () => {
    await renderCatalog();
    await fireEvent.press(screen.getByTestId('recipe-card-mug-cake'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/recette/[id]',
      params: { id: 'id-mug' },
    });
  });

  it('chargement', async () => {
    mockQuery = { ...mockQuery, data: undefined, isPending: true };
    await renderCatalog();
    expect(screen.getByLabelText('Chargement des recettes')).toBeOnTheScreen();
  });

  it('erreur : message et nouvel essai', async () => {
    mockQuery = { ...mockQuery, data: undefined, isError: true };
    await renderCatalog();
    expect(screen.getByRole('alert')).toHaveTextContent('Oups, un petit pépin');
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('catalogue vide', async () => {
    mockQuery = { ...mockQuery, data: [] };
    await renderCatalog();
    expect(screen.getByText('Les recettes arrivent bientôt')).toBeOnTheScreen();
  });
});
