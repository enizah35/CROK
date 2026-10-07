import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignInFlow } from './SignInFlow';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
    },
  },
}));

const auth = supabase.auth as unknown as {
  signInWithOtp: jest.Mock;
  verifyOtp: jest.Mock;
};

function renderFlow() {
  const client = new QueryClient({
    // gcTime infini : pas de minuteur de nettoyage qui survivrait au test.
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <SignInFlow />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
});

describe('SignInFlow (R-32)', () => {
  it('email → envoi du code → vérification du code', async () => {
    renderFlow();
    fireEvent.changeText(screen.getByTestId('email-input'), '  Lea@Exemple.fr ');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir mon code' }));

    await screen.findByTestId('otp-input');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'lea@exemple.fr',
      options: { shouldCreateUser: true },
    });

    fireEvent.changeText(screen.getByTestId('otp-input'), '654321');
    await waitFor(() =>
      expect(auth.verifyOtp).toHaveBeenCalledWith({
        email: 'lea@exemple.fr',
        token: '654321',
        type: 'email',
      }),
    );
  });

  it('bloque un email mal formé', () => {
    renderFlow();
    fireEvent.changeText(screen.getByTestId('email-input'), 'lea@exemple');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir mon code' }));
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('affiche un message clair si le code est faux', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' },
    });
    renderFlow();
    fireEvent.changeText(screen.getByTestId('email-input'), 'lea@exemple.fr');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir mon code' }));
    fireEvent.changeText(await screen.findByTestId('otp-input'), '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Code incorrect ou expiré/);
  });

  it("revient à la saisie de l'email avec l'adresse pré-remplie", async () => {
    renderFlow();
    fireEvent.changeText(screen.getByTestId('email-input'), 'lea@exemple.fr');
    fireEvent.press(screen.getByRole('button', { name: 'Recevoir mon code' }));
    await screen.findByTestId('otp-input');
    fireEvent.press(screen.getByRole('button', { name: 'Changer d’adresse' }));
    expect(screen.getByTestId('email-input')).toHaveDisplayValue('lea@exemple.fr');
  });
});
