import {
  allowedGroup,
  entryHref,
  isOnboardingComplete,
  resolveAccountStatus,
  type AccountInput,
  type OnboardingFields,
} from './accountStatus';

const done: OnboardingFields = {
  pseudo: 'Lea',
  avatar_id: 3,
  adult_confirmed_at: '2026-10-07T18:00:00Z',
};

function input(overrides: Partial<AccountInput>): AccountInput {
  return {
    sessionLoading: false,
    userId: 'user-1',
    profileError: false,
    profile: undefined,
    ...overrides,
  };
}

describe('isOnboardingComplete (R-32)', () => {
  it('exige pseudo, avatar et confirmation 18+', () => {
    expect(isOnboardingComplete(done)).toBe(true);
    expect(isOnboardingComplete(null)).toBe(false);
    expect(isOnboardingComplete(undefined)).toBe(false);
    expect(isOnboardingComplete({ ...done, pseudo: null })).toBe(false);
    expect(isOnboardingComplete({ ...done, avatar_id: null })).toBe(false);
  });

  it('sans 18+, onboarding non fini', () => {
    expect(isOnboardingComplete({ ...done, adult_confirmed_at: null })).toBe(false);
  });
});

describe('resolveAccountStatus : garde de navigation', () => {
  it('attend la restauration de la session', () => {
    expect(resolveAccountStatus(input({ sessionLoading: true, userId: null }))).toBe('loading');
  });

  it('non connecté → connexion', () => {
    const status = resolveAccountStatus(input({ userId: null }));
    expect(status).toBe('signed_out');
    expect(allowedGroup(status)).toBe('auth');
    expect(entryHref(status)).toBe('/connexion');
  });

  it('connecté, profil en chargement → attente', () => {
    const status = resolveAccountStatus(input({ profile: undefined }));
    expect(status).toBe('loading');
    expect(allowedGroup(status)).toBeNull();
    expect(entryHref(status)).toBeNull();
  });

  it('connecté sans profil → onboarding', () => {
    const status = resolveAccountStatus(input({ profile: null }));
    expect(status).toBe('onboarding');
    expect(allowedGroup(status)).toBe('onboarding');
    expect(entryHref(status)).toBe('/bienvenue');
  });

  it('connecté, profil créé sans 18+ → onboarding (bloqué)', () => {
    const status = resolveAccountStatus(input({ profile: { ...done, adult_confirmed_at: null } }));
    expect(status).toBe('onboarding');
  });

  it('connecté, onboarding fini → app', () => {
    const status = resolveAccountStatus(input({ profile: done }));
    expect(status).toBe('ready');
    expect(allowedGroup(status)).toBe('app');
    expect(entryHref(status)).toBe('/recettes');
  });

  it('erreur réseau sans profil en cache → écran de reprise', () => {
    const status = resolveAccountStatus(input({ profileError: true }));
    expect(status).toBe('error');
    expect(allowedGroup(status)).toBeNull();
  });

  it('erreur réseau avec profil en cache → on garde le profil', () => {
    expect(resolveAccountStatus(input({ profileError: true, profile: done }))).toBe('ready');
  });

  it('la session prime : déconnecté même si un profil traîne en cache', () => {
    expect(resolveAccountStatus(input({ userId: null, profile: done }))).toBe('signed_out');
  });
});
