import { onboardingErrorMessage, sendCodeErrorMessage, verifyCodeErrorMessage } from './errors';

describe('messages d’erreur', () => {
  it('pseudo pris (R-32)', () => {
    expect(onboardingErrorMessage({ code: '23505', message: 'pseudo_taken' })).toBe(
      'Ce pseudo est déjà pris. Choisis-en un autre.',
    );
  });

  it('pseudo invalide refusé par le serveur', () => {
    expect(onboardingErrorMessage({ code: '22023', message: 'invalid_pseudo' })).toContain(
      'pas valide',
    );
  });

  it('session expirée pendant l’onboarding', () => {
    expect(onboardingErrorMessage({ code: '42501', message: 'not_authenticated' })).toContain(
      'Reconnecte-toi',
    );
  });

  it('code incorrect ou expiré', () => {
    expect(verifyCodeErrorMessage({ code: 'otp_expired', status: 403 })).toContain(
      'Code incorrect',
    );
  });

  it('trop de demandes de code', () => {
    expect(sendCodeErrorMessage({ code: 'over_email_send_rate_limit', status: 429 })).toContain(
      'Trop de demandes',
    );
  });

  it('réseau coupé', () => {
    const error = { name: 'AuthRetryableFetchError', message: 'Network request failed' };
    expect(sendCodeErrorMessage(error)).toContain('Pas de connexion');
    expect(verifyCodeErrorMessage(error)).toContain('Pas de connexion');
  });

  it('erreur inconnue', () => {
    expect(onboardingErrorMessage('boom')).toContain('Un problème est survenu');
    expect(sendCodeErrorMessage(null)).toContain('Un problème est survenu');
  });
});
