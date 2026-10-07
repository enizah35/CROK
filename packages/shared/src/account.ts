/**
 * Règles du compte (R-32) : pseudo, avatar, code reçu par email.
 *
 * Les mêmes règles sont appliquées côté serveur par la fonction SQL `complete_onboarding`
 * (supabase/migrations/20261008000000_complete_onboarding.sql) : toute modification ici doit
 * être reportée là-bas, avec les mêmes cas de test.
 */

export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;

/** Lettres sans accent, chiffres et tiret bas. Même motif que la contrainte SQL. */
export const PSEUDO_PATTERN = /^[A-Za-z0-9_]+$/;

export type PseudoError = 'too_short' | 'too_long' | 'invalid_chars';

export type PseudoValidation = { ok: true; pseudo: string } | { ok: false; error: PseudoError };

/** Forme enregistrée d'un pseudo saisi : espaces de début et de fin retirés. */
export function normalizePseudo(raw: string): string {
  return raw.trim();
}

/**
 * Clé d'unicité d'un pseudo (R-32) : l'unicité ne tient pas compte de la casse,
 * « Lea » et « lea » sont le même pseudo. Équivalent SQL : `lower(pseudo)`.
 */
export function pseudoKey(pseudo: string): string {
  return normalizePseudo(pseudo).toLowerCase();
}

// R-32 : pseudo de 3 à 20 caractères.
export function validatePseudo(raw: string): PseudoValidation {
  const pseudo = normalizePseudo(raw);
  if (pseudo.length < PSEUDO_MIN_LENGTH) return { ok: false, error: 'too_short' };
  if (pseudo.length > PSEUDO_MAX_LENGTH) return { ok: false, error: 'too_long' };
  if (!PSEUDO_PATTERN.test(pseudo)) return { ok: false, error: 'invalid_chars' };
  return { ok: true, pseudo };
}

const PSEUDO_ERROR_MESSAGES: Record<PseudoError, string> = {
  too_short: `Ton pseudo doit faire au moins ${PSEUDO_MIN_LENGTH} caractères.`,
  too_long: `Ton pseudo doit faire au plus ${PSEUDO_MAX_LENGTH} caractères.`,
  invalid_chars: 'Utilise seulement des lettres sans accent, des chiffres et « _ ».',
};

export function pseudoErrorMessage(error: PseudoError): string {
  return PSEUDO_ERROR_MESSAGES[error];
}

// R-32 : avatar choisi parmi 12.
export const AVATAR_COUNT = 12;
export const AVATAR_IDS: readonly number[] = Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1);

export function isValidAvatarId(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= AVATAR_COUNT;
}

// R-32 : code à 6 chiffres reçu par email.
export const OTP_LENGTH = 6;

/** Garde uniquement les chiffres d'une saisie (ou d'un collage) et coupe à 6. */
export function sanitizeOtpInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isCompleteOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code);
}

/** Forme envoyée à Supabase : sans espaces, en minuscules. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Contrôle de forme seulement : c'est l'envoi du code qui prouve l'adresse. */
export function isPlausibleEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}
