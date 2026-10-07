import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('affiche le libellé et expose le rôle bouton', async () => {
    await render(<Button label="Je cuisine" onPress={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Je cuisine' });
    expect(button).toBeOnTheScreen();
    expect(button).toBeEnabled();
  });

  it('appelle onPress quand on appuie', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Je cuisine" onPress={onPress} />);
    await user.press(screen.getByRole('button', { name: 'Je cuisine' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['primary', 'secondary', 'ghost'] as const)('se rend en variante %s', async (variant) => {
    await render(<Button label="Action" variant={variant} onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Action' })).toBeOnTheScreen();
  });

  it('désactivé : état annoncé et appui ignoré', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Valider" disabled onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Valider' });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('chargement : occupé, désactivé, appui ignoré', async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await render(<Button label="Envoi" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Envoi' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('utilise accessibilityLabel quand il est fourni', async () => {
    await render(
      <Button label="OK" accessibilityLabel="Valider le pseudo" onPress={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Valider le pseudo' })).toBeOnTheScreen();
  });

  it('zone tactile ≥ 44 pt', async () => {
    await render(<Button label="Go" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveStyle({ minHeight: 48 });
  });
});
