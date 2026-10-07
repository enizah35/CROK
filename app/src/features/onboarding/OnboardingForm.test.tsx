import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingForm } from './OnboardingForm';

const mockMutate = jest.fn();
let mockAvailability: { data: boolean | undefined; isFetching: boolean } = {
  data: true,
  isFetching: false,
};
let mockMutationState: { isError: boolean; error: unknown } = { isError: false, error: null };

jest.mock('./api', () => ({
  // Pas d'attente dans les tests : la valeur suit immédiatement.
  useDebouncedValue: <T,>(value: T) => value,
  usePseudoAvailability: () => mockAvailability,
  useCompleteOnboarding: () => ({
    mutate: mockMutate,
    reset: jest.fn(),
    isPending: false,
    ...mockMutationState,
  }),
}));

beforeEach(() => {
  mockMutate.mockReset();
  mockAvailability = { data: true, isFetching: false };
  mockMutationState = { isError: false, error: null };
});

async function fillValidForm() {
  await fireEvent.changeText(screen.getByTestId('pseudo-input'), 'Lea_2006');
  await fireEvent.press(screen.getByTestId('avatar-5'));
}

describe('OnboardingForm (R-32)', () => {
  it('sans la case 18+ : bouton désactivé, rien n’est envoyé', async () => {
    await render(<OnboardingForm />);
    await fillValidForm();
    const submit = screen.getByRole('button', { name: 'C’est parti' });
    expect(submit).toBeDisabled();
    await fireEvent.press(submit);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('avec la case 18+ : envoie pseudo et avatar', async () => {
    await render(<OnboardingForm />);
    await fillValidForm();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'J’ai 18 ans ou plus' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'C’est parti' }));
    expect(mockMutate).toHaveBeenCalledWith({ pseudo: 'Lea_2006', avatarId: 5 });
  });

  it('pseudo déjà pris : message clair et envoi bloqué', async () => {
    mockAvailability = { data: false, isFetching: false };
    await render(<OnboardingForm />);
    await fillValidForm();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(screen.getByText('Ce pseudo est déjà pris. Choisis-en un autre.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'C’est parti' })).toBeDisabled();
  });

  it('pseudo trop court : message de règle', async () => {
    await render(<OnboardingForm />);
    await fireEvent.changeText(screen.getByTestId('pseudo-input'), 'ab');
    expect(screen.getByText('Ton pseudo doit faire au moins 3 caractères.')).toBeOnTheScreen();
  });

  it('refus serveur (course sur le pseudo) : message clair', async () => {
    mockMutationState = { isError: true, error: { code: '23505', message: 'pseudo_taken' } };
    await render(<OnboardingForm />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Ce pseudo est déjà pris/);
  });

  it('propose 12 avatars', async () => {
    await render(<OnboardingForm />);
    expect(screen.getAllByRole('radio')).toHaveLength(12);
  });
});
