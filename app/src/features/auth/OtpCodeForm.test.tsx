import { fireEvent, render, screen } from '@testing-library/react-native';

import { OtpCodeForm } from './OtpCodeForm';

function setup(overrides: Partial<React.ComponentProps<typeof OtpCodeForm>> = {}) {
  const props = {
    email: 'lea@exemple.fr',
    busy: false,
    error: null,
    onSubmit: jest.fn(),
    onResend: jest.fn(),
    onChangeEmail: jest.fn(),
    ...overrides,
  };
  render(<OtpCodeForm {...props} />);
  return props;
}

describe('OtpCodeForm (R-32)', () => {
  it("rappelle l'adresse et bloque « Valider » tant que le code est incomplet", () => {
    const props = setup();
    expect(screen.getByText('lea@exemple.fr')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId('otp-input'), '123');
    fireEvent.press(screen.getByRole('button', { name: 'Valider' }));
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
  });

  it('ne garde que les chiffres et valide automatiquement au 6e', () => {
    const props = setup();
    const input = screen.getByTestId('otp-input');
    fireEvent.changeText(input, '12a 34');
    expect(input).toHaveDisplayValue('1234');
    expect(props.onSubmit).not.toHaveBeenCalled();
    fireEvent.changeText(input, '123 456');
    expect(input).toHaveDisplayValue('123456');
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith('123456');
  });

  it('accepte un code collé plus long en le coupant à 6 chiffres', () => {
    const props = setup();
    fireEvent.changeText(screen.getByTestId('otp-input'), '12345678');
    expect(props.onSubmit).toHaveBeenCalledWith('123456');
  });

  it('affiche l’erreur et permet de renvoyer un code ou de changer d’adresse', () => {
    const props = setup({ error: 'Code incorrect ou expiré.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Code incorrect ou expiré.');
    fireEvent.press(screen.getByRole('button', { name: 'Renvoyer un code' }));
    fireEvent.press(screen.getByRole('button', { name: 'Changer d’adresse' }));
    expect(props.onResend).toHaveBeenCalledTimes(1);
    expect(props.onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it('ne renvoie pas le code pendant une vérification en cours', () => {
    const props = setup({ busy: true });
    fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
