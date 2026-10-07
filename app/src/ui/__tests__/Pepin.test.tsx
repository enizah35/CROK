import { render, screen } from '@testing-library/react-native';

import { Pepin, PEPIN_ETATS, PEPIN_LABELS } from '../Pepin';

describe('Pepin (R-30)', () => {
  it('a exactement les 6 états de R-30', () => {
    expect([...PEPIN_ETATS].sort()).toEqual(
      ['affame', 'en_feu', 'fete', 'fier', 'motive', 'neutre'].sort(),
    );
  });

  it.each(PEPIN_ETATS)('état %s : image accessible avec son visage', async (etat) => {
    await render(<Pepin etat={etat} />);
    const image = screen.getByRole('image', { name: PEPIN_LABELS[etat] });
    expect(image).toBeOnTheScreen();
    expect(screen.getByTestId(`pepin-visage-${etat}`)).toBeOnTheScreen();
  });

  it('les libellés sont tous différents', () => {
    expect(new Set(Object.values(PEPIN_LABELS)).size).toBe(PEPIN_ETATS.length);
  });

  it('flammes seulement en_feu, chapeau seulement en fête', async () => {
    await render(<Pepin etat="en_feu" />);
    expect(screen.getByTestId('pepin-flammes')).toBeOnTheScreen();
    expect(screen.queryByTestId('pepin-chapeau')).toBeNull();

    await render(<Pepin etat="fete" />);
    expect(screen.getByTestId('pepin-chapeau')).toBeOnTheScreen();
    expect(screen.queryByTestId('pepin-flammes')).toBeNull();

    await render(<Pepin etat="neutre" />);
    expect(screen.queryByTestId('pepin-flammes')).toBeNull();
    expect(screen.queryByTestId('pepin-chapeau')).toBeNull();
  });

  it('respecte la taille demandée', async () => {
    await render(<Pepin etat="neutre" taille={64} />);
    expect(screen.getByTestId('pepin-neutre')).toHaveStyle({ width: 64, height: 64 });
  });

  it('accepte un libellé personnalisé', async () => {
    await render(<Pepin etat="fier" accessibilityLabel="Bravo !" />);
    expect(screen.getByRole('image', { name: 'Bravo !' })).toBeOnTheScreen();
  });
});
