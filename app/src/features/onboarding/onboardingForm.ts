import { isValidAvatarId, validatePseudo, type PseudoError } from '@crok/shared';

/** État du formulaire d'onboarding (R-32), logique pure testée. */
export type OnboardingDraft = {
  pseudo: string;
  avatarId: number | null;
  adultConfirmed: boolean;
};

export type PseudoAvailability = 'unknown' | 'checking' | 'available' | 'taken';

export type OnboardingCheck =
  | { canSubmit: true; pseudo: string; avatarId: number }
  | {
      canSubmit: false;
      pseudoError: PseudoError | null;
      pseudoTaken: boolean;
      missingAvatar: boolean;
      missingAdult: boolean;
    };

export function checkOnboarding(
  draft: OnboardingDraft,
  availability: PseudoAvailability,
): OnboardingCheck {
  const pseudo = validatePseudo(draft.pseudo);
  const avatarOk = draft.avatarId !== null && isValidAvatarId(draft.avatarId);
  const taken = availability === 'taken';
  // R-32 : sans la case « J'ai 18 ans ou plus », on ne peut pas continuer.
  if (pseudo.ok && !taken && avatarOk && draft.adultConfirmed && draft.avatarId !== null) {
    return { canSubmit: true, pseudo: pseudo.pseudo, avatarId: draft.avatarId };
  }
  return {
    canSubmit: false,
    pseudoError: pseudo.ok ? null : pseudo.error,
    pseudoTaken: taken,
    missingAvatar: !avatarOk,
    missingAdult: !draft.adultConfirmed,
  };
}
