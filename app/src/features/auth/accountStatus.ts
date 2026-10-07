/**
 * Garde de navigation (R-32) : logique pure, testée dans accountStatus.test.ts.
 *
 * non connecté → (auth) ; connecté sans onboarding fini → (onboarding) ; sinon → l'app.
 */
import type { Tables } from '@crok/shared';

export type AccountStatus = 'loading' | 'signed_out' | 'onboarding' | 'ready' | 'error';

export type OnboardingFields = Pick<
  Tables<'profiles'>,
  'pseudo' | 'avatar_id' | 'adult_confirmed_at'
>;

/** Onboarding fini : pseudo, avatar et confirmation 18+ enregistrés (R-32). */
export function isOnboardingComplete(profile: OnboardingFields | null | undefined): boolean {
  return (
    profile != null &&
    profile.pseudo != null &&
    profile.avatar_id != null &&
    profile.adult_confirmed_at != null
  );
}

export type AccountInput = {
  sessionLoading: boolean;
  userId: string | null;
  profileError: boolean;
  /** `null` : aucune ligne profiles pour cet utilisateur (onboarding pas commencé). */
  profile: OnboardingFields | null | undefined;
};

export function resolveAccountStatus(input: AccountInput): AccountStatus {
  if (input.sessionLoading) return 'loading';
  if (input.userId === null) return 'signed_out';
  // Un profil déjà en cache reste utilisable pendant un rechargement ou après une erreur réseau.
  if (input.profile !== undefined) {
    return isOnboardingComplete(input.profile) ? 'ready' : 'onboarding';
  }
  if (input.profileError) return 'error';
  return 'loading';
}

export type RouteGroup = 'auth' | 'onboarding' | 'app';

/** Groupe de routes accessible dans cet état ; `null` : aucun (chargement ou erreur). */
export function allowedGroup(status: AccountStatus): RouteGroup | null {
  switch (status) {
    case 'signed_out':
      return 'auth';
    case 'onboarding':
      return 'onboarding';
    case 'ready':
      return 'app';
    case 'loading':
    case 'error':
      return null;
  }
}

export type EntryHref = '/connexion' | '/bienvenue' | '/recettes';

/** Écran d'arrivée dans cet état ; `null` : rester sur l'écran d'attente. */
export function entryHref(status: AccountStatus): EntryHref | null {
  switch (allowedGroup(status)) {
    case 'auth':
      return '/connexion';
    case 'onboarding':
      return '/bienvenue';
    case 'app':
      return '/recettes';
    case null:
      return null;
  }
}
