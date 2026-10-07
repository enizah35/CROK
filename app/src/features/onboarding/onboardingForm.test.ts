import { checkOnboarding, type OnboardingDraft } from './onboardingForm';

const ok: OnboardingDraft = { pseudo: ' Lea ', avatarId: 4, adultConfirmed: true };

describe('checkOnboarding (R-32)', () => {
  it('formulaire complet → envoi possible, pseudo normalisé', () => {
    expect(checkOnboarding(ok, 'available')).toEqual({
      canSubmit: true,
      pseudo: 'Lea',
      avatarId: 4,
    });
  });

  it('disponibilité pas encore connue : le serveur tranchera', () => {
    expect(checkOnboarding(ok, 'unknown').canSubmit).toBe(true);
  });

  it('sans la case 18+ → bloqué', () => {
    expect(checkOnboarding({ ...ok, adultConfirmed: false }, 'available')).toMatchObject({
      canSubmit: false,
      missingAdult: true,
    });
  });

  it('pseudo pris → bloqué', () => {
    expect(checkOnboarding(ok, 'taken')).toMatchObject({ canSubmit: false, pseudoTaken: true });
  });

  it('pseudo trop court → bloqué', () => {
    expect(checkOnboarding({ ...ok, pseudo: 'ab' }, 'unknown')).toMatchObject({
      canSubmit: false,
      pseudoError: 'too_short',
    });
  });

  it('sans avatar → bloqué', () => {
    expect(checkOnboarding({ ...ok, avatarId: null }, 'available')).toMatchObject({
      canSubmit: false,
      missingAvatar: true,
    });
  });

  it('avatar hors des 12 → bloqué', () => {
    expect(checkOnboarding({ ...ok, avatarId: 13 }, 'available').canSubmit).toBe(false);
  });
});
