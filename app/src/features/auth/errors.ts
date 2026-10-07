/** Traduction des erreurs Supabase en messages clairs, en français. */

type ErrorLike = { code?: unknown; status?: unknown; message?: unknown; name?: unknown };

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
}

const NETWORK_MESSAGE = 'Pas de connexion. Vérifie ton réseau et réessaie.';
const GENERIC_MESSAGE = 'Un problème est survenu. Réessaie dans un instant.';

function isNetworkError(e: ErrorLike): boolean {
  return (
    e.name === 'AuthRetryableFetchError' ||
    (typeof e.message === 'string' && /network request failed|failed to fetch/i.test(e.message))
  );
}

/** Erreurs de signInWithOtp (envoi du code). */
export function sendCodeErrorMessage(error: unknown): string {
  const e = asErrorLike(error);
  if (isNetworkError(e)) return NETWORK_MESSAGE;
  if (e.status === 429 || e.code === 'over_email_send_rate_limit') {
    return 'Trop de demandes de code. Attends une minute avant de réessayer.';
  }
  if (e.code === 'email_address_invalid' || e.code === 'validation_failed') {
    return 'Cette adresse email ne semble pas valide.';
  }
  return GENERIC_MESSAGE;
}

/** Erreurs de verifyOtp (saisie du code). */
export function verifyCodeErrorMessage(error: unknown): string {
  const e = asErrorLike(error);
  if (isNetworkError(e)) return NETWORK_MESSAGE;
  if (e.status === 429 || e.code === 'over_request_rate_limit') {
    return 'Trop de tentatives. Attends une minute avant de réessayer.';
  }
  if (e.code === 'otp_expired' || e.status === 403 || e.status === 401) {
    return 'Code incorrect ou expiré. Vérifie-le ou demande un nouveau code.';
  }
  return GENERIC_MESSAGE;
}

/** Erreurs de complete_onboarding (codes définis dans la migration SQL). */
export function onboardingErrorMessage(error: unknown): string {
  const e = asErrorLike(error);
  if (isNetworkError(e)) return NETWORK_MESSAGE;
  if (e.message === 'pseudo_taken' || e.code === '23505') {
    return 'Ce pseudo est déjà pris. Choisis-en un autre.';
  }
  if (e.message === 'invalid_pseudo') {
    return 'Ce pseudo n’est pas valide : 3 à 20 lettres sans accent, chiffres ou « _ ».';
  }
  if (e.message === 'invalid_avatar') return 'Choisis un avatar.';
  if (e.message === 'not_authenticated' || e.code === '42501') {
    return 'Ta session a expiré. Reconnecte-toi.';
  }
  return GENERIC_MESSAGE;
}
