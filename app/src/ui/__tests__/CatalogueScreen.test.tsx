import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CatalogueScreen } from '../CatalogueScreen';
import { PEPIN_ETATS, PEPIN_LABELS } from '../Pepin';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('CatalogueScreen', () => {
  it('montre les 6 états de Pépin et les composants interactifs accessibles', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CatalogueScreen />
      </SafeAreaProvider>,
    );
    for (const etat of PEPIN_ETATS) {
      expect(screen.getAllByRole('image', { name: PEPIN_LABELS[etat] }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole('radio')).toHaveLength(12);
    expect(screen.getByRole('checkbox', { name: 'Micro-ondes' })).not.toBeChecked();
    // 3/3 et 4/3 : l'affichage est borné à l'objectif.
    expect(
      screen.getAllByRole('progressbar', {
        name: /Objectif de la semaine atteint : 3 plats sur 3/,
      }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('progressbar', { name: 'Série de la semaine : 0 plat sur 3' }),
    ).toBeOnTheScreen();
  });

  it('bascule en mode sombre et coche les filtres', async () => {
    const user = userEvent.setup();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CatalogueScreen />
      </SafeAreaProvider>,
    );
    await user.press(screen.getByRole('checkbox', { name: 'Sombre' }));
    expect(screen.getByText(/Mode actuel : sombre/)).toBeOnTheScreen();
    await user.press(screen.getByRole('checkbox', { name: 'Micro-ondes' }));
    expect(screen.getByRole('checkbox', { name: 'Micro-ondes' })).toBeChecked();
  });
});
