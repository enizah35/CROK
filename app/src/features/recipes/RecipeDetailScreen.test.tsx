import { fireEvent, render, screen } from '@testing-library/react-native';

import type { RecipeDetail } from './api';
import { dahl } from './fixtures';
import { RecipeDetailScreen } from './RecipeDetailScreen';
import { TestProviders } from './testUtils';

const mockPush = jest.fn();
const mockBack = jest.fn();

type QueryState = {
  data: RecipeDetail | null | undefined;
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: () => void;
};
let mockQuery: QueryState;

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: () => mockBack(),
  },
  Stack: { Screen: () => null },
}));

jest.mock('./api', () => ({
  useRecipe: () => mockQuery,
}));

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockQuery = {
    data: dahl,
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
  };
});

async function renderDetail() {
  await render(
    <TestProviders>
      <RecipeDetailScreen id="id-dahl" />
    </TestProviders>,
  );
}

const quantity = (index: number) => screen.getByTestId(`ingredient-qty-${index}`);

describe('RecipeDetailScreen', () => {
  it('affiche les infos, les ingrédients pour servings_base et les étapes', async () => {
    await renderDetail();
    expect(screen.getByText('Dahl de lentilles corail')).toBeOnTheScreen();
    expect(screen.getByText('1,10\u00a0€ la portion')).toBeOnTheScreen();
    expect(screen.getByText('Il te faut : Plaques')).toBeOnTheScreen();
    expect(screen.getByTestId('servings-value')).toHaveTextContent('4 portions');
    expect(quantity(0)).toHaveTextContent('250\u00a0g', { exact: true });
    expect(screen.getByLabelText('250\u00a0g lentilles corail')).toBeOnTheScreen();
    expect(quantity(4)).toHaveTextContent('selon ton goût', { exact: true });
    expect(screen.getByText('Les étapes (3)')).toBeOnTheScreen();
    expect(screen.getByText('1. Émince l’oignon finement.')).toBeOnTheScreen();
  });

  it('changer les portions met les quantités à l’échelle (R-04)', async () => {
    await renderDetail();
    const plus = screen.getByRole('button', { name: 'Une portion de plus' });
    await fireEvent.press(plus);
    await fireEvent.press(plus);
    expect(screen.getByTestId('servings-value')).toHaveTextContent('6 portions');
    expect(plus).toBeDisabled();
    expect(quantity(0)).toHaveTextContent('375\u00a0g', { exact: true }); // 250 × 6/4
    expect(quantity(1)).toHaveTextContent('1\u00a0½', { exact: true });
    expect(quantity(2)).toHaveTextContent('3\u00a0c. à café', { exact: true });
    expect(quantity(3)).toHaveTextContent('1', { exact: true }); // non_scalable

    const minus = screen.getByRole('button', { name: 'Une portion de moins' });
    for (let i = 0; i < 5; i++) await fireEvent.press(minus);
    expect(screen.getByTestId('servings-value')).toHaveTextContent('1 portion');
    expect(minus).toBeDisabled();
    expect(quantity(0)).toHaveTextContent('65\u00a0g', { exact: true }); // 62,5 → 65
    expect(quantity(1)).toHaveTextContent('½', { exact: true });
    expect(quantity(2)).toHaveTextContent('½\u00a0c. à café', { exact: true });
    expect(quantity(3)).toHaveTextContent('1', { exact: true });
  });

  it('« Cuisiner » lance le mode cuisine avec la recette et les portions', async () => {
    await renderDetail();
    await fireEvent.press(screen.getByRole('button', { name: 'Une portion de moins' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cuisiner' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/cook/lancer',
      params: { recipeId: 'id-dahl', servings: '3' },
    });
  });

  it('recette introuvable', async () => {
    mockQuery = { ...mockQuery, data: null };
    await renderDetail();
    expect(screen.getByText('Recette introuvable')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voir les recettes' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('erreur de chargement', async () => {
    mockQuery = { ...mockQuery, data: undefined, isError: true };
    await renderDetail();
    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });
});
