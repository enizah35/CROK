import { fireEvent, render, screen } from '@testing-library/react-native';

import { dishesFixture } from './fixtures';
import { MyDishesList } from './MyDishesList';

describe('MyDishesList', () => {
  it('liste vide : message et lien vers les recettes', async () => {
    const onBrowse = jest.fn();
    await render(<MyDishesList dishes={[]} onBrowseRecipes={onBrowse} />);
    expect(screen.getByText('Pas encore de plat')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Choisir une recette' }));
    expect(onBrowse).toHaveBeenCalled();
  });

  it('liste remplie : recette, date, compté ou non, visuel de remplacement', async () => {
    await render(<MyDishesList dishes={dishesFixture} currentYear={2026} />);
    expect(
      screen.getByLabelText('Dahl de lentilles corail, lundi 5 octobre, Compté'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Recette retirée, mercredi 31 décembre 2025, Hors compteur'),
    ).toBeOnTheScreen();
    expect(
      screen.getAllByTestId('dish-photo-placeholder', { includeHiddenElements: true }),
    ).toHaveLength(2);
  });
});
