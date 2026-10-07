/**
 * Validation d'un plat côté app (tâche 1.4) : forme de la réponse de `complete_cook_session`,
 * codes d'erreur du serveur et textes affichés. Aucune règle d'XP ici (R-08, R-15) : l'app
 * affiche ce que renvoie le serveur. Contrat : docs/api-serveur.md.
 */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ attendue');
const count = z.number().int().nonnegative();

/** Réponse de `complete_cook_session` (R-08 à R-16). */
export const cookResultSchema = z.object({
  dish_id: z.uuid(),
  counted: z.boolean(),
  xp_awarded: count,
  week_start: isoDate,
  week_dishes_count: count,
  goal_reached: z.boolean(),
  streak: count,
  lifetime_xp: count,
  /** R-10 : rappel sur une session déjà validée (après un échec réseau) ; rien de plus créé. */
  already_completed: z.boolean(),
});
export type CookResult = z.infer<typeof cookResultSchema>;

/**
 * Sous-ensemble de `get_active_cook_session` utile à l'app pour estimer l'attente après
 * `too_early` (la fonction renvoie `null` sans session en cours).
 */
export const cookSessionTimingSchema = z
  .object({
    id: z.uuid(),
    recipe_id: z.uuid(),
    started_at: z.iso.datetime({ offset: true }),
    server_now: z.iso.datetime({ offset: true }),
  })
  .nullable();
export type CookSessionTiming = z.infer<typeof cookSessionTimingSchema>;

/** Messages d'exception de `complete_cook_session` (le `message` est le code). */
export const COOK_ERROR_CODES = [
  'session_not_found',
  'session_not_running',
  'session_expired',
  'too_early',
  'photo_missing',
  'duplicate_photo',
  'invalid_photo_path',
  // Hors contrat : seulement en cas de bug du client.
  'invalid_photo_sha256',
  'not_authenticated',
] as const;
export type CookErrorCode = (typeof COOK_ERROR_CODES)[number];

/** Code serveur connu, ou `null` (échec réseau, erreur inattendue). */
export function cookErrorCode(message: unknown): CookErrorCode | null {
  return (COOK_ERROR_CODES as readonly unknown[]).includes(message)
    ? (message as CookErrorCode)
    : null;
}

/**
 * Ce que l'écran propose après une erreur :
 * - `retry` : renvoyer la même photo (même chemin, même session : sans risque de doublon, R-10) ;
 * - `retake` : reprendre une autre photo ;
 * - `leave` : la session ne peut plus être validée, retour aux recettes.
 */
export type CookErrorAction = 'retry' | 'retake' | 'leave';

export type CookErrorView = {
  title: string;
  message: string;
  action: CookErrorAction;
};

/** « 3 min », « moins d’une minute ». Arrondi à la minute supérieure. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return 'moins d’une minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Texte affiché pour une erreur de validation. `code = null` : échec réseau ou réponse
 * inattendue, on peut réessayer sans risque. `waitSeconds` : attente estimée pour `too_early`.
 */
export function cookErrorView(
  code: CookErrorCode | null,
  options: { waitSeconds?: number | null } = {},
): CookErrorView {
  switch (code) {
    case null:
      return {
        title: 'La connexion a coincé',
        message: 'Ton plat n’est pas perdu : vérifie ta connexion et réessaie.',
        action: 'retry',
      };
    case 'too_early': {
      const wait = options.waitSeconds;
      return {
        title: 'C’est un peu rapide !',
        message:
          wait !== undefined && wait !== null && wait > 0
            ? `Ton plat pourra être validé dans ${formatWait(wait)}. Garde ta photo et réessaie à ce moment-là.`
            : 'C’est un peu rapide pour cette recette. Laisse mijoter encore un peu, puis réessaie avec la même photo.',
        action: 'retry',
      };
    }
    case 'photo_missing':
      return {
        title: 'La photo n’est pas arrivée',
        message: 'Elle s’est perdue en route. On la renvoie ?',
        action: 'retry',
      };
    case 'duplicate_photo':
      return {
        title: 'Cette photo a déjà servi',
        message: 'Elle a déjà validé un de tes plats. Prends une nouvelle photo de celui-ci.',
        action: 'retake',
      };
    case 'invalid_photo_path':
    case 'invalid_photo_sha256':
      return {
        title: 'Un petit souci technique',
        message: 'Ta photo n’a pas pu être vérifiée. Reprends-la et réessaie.',
        action: 'retake',
      };
    case 'session_expired':
      return {
        title: 'Session expirée',
        message:
          'Plus de 6 h se sont écoulées depuis le début de la recette : elle ne peut plus être validée. La prochaine sera la bonne !',
        action: 'leave',
      };
    case 'session_not_running':
      return {
        title: 'Cette session est terminée',
        message:
          'Elle a été passée ou abandonnée, elle ne peut plus être validée. Relance la recette quand tu veux.',
        action: 'leave',
      };
    case 'session_not_found':
      return {
        title: 'Session introuvable',
        message:
          'On ne retrouve pas cette session de cuisine. Relance la recette pour valider ton plat.',
        action: 'leave',
      };
    case 'not_authenticated':
      return {
        title: 'Tu as été déconnecté',
        message: 'Reconnecte-toi, puis relance la recette.',
        action: 'leave',
      };
  }
}

/**
 * Attente estimée avant que `complete_cook_session` accepte la session, pour l'afficher après
 * `too_early` : max(5 min, 40 % du temps actif) depuis `started_at` (R-09), à partir de
 * l'heure du serveur. Affichage seulement : le serveur reste seul juge. Secondes, ≥ 0.
 */
export function secondsUntilValidation(input: {
  startedAt: string;
  serverNow: string;
  activeMin: number;
}): number {
  const elapsed = (Date.parse(input.serverNow) - Date.parse(input.startedAt)) / 1000;
  const minDelay = Math.max(5 * 60, input.activeMin * 60 * 0.4);
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, Math.ceil(minDelay - elapsed));
}

/**
 * Chemin de la photo dans le bucket privé `dishes` : `{uid}/{session}/{sha256}.jpg` (R-09).
 * Nommer le fichier par son empreinte rend l'envoi rejouable sans risque : le même fichier
 * retombe au même chemin (le stockage répond « existe déjà », ce qui vaut succès), une autre
 * photo (après `duplicate_photo` par exemple) a son propre chemin. La RLS du stockage
 * n'autorise pas l'écrasement, donc pas d'upsert.
 */
export function dishPhotoPath(userId: string, sessionId: string, sha256: string): string {
  return `${userId}/${sessionId}/${sha256}.jpg`;
}

/** Explication quand le plat est enregistré sans XP (R-11). */
export const NOT_COUNTED_MESSAGE =
  'Ton plat est bien enregistré, mais il ne rapporte pas d’XP aujourd’hui : on compte au plus 2 plats par jour, et chaque recette une seule fois par jour. Tu remets ça demain ?';

/** Écran neutre après « Passer » (R-07). */
export const SKIPPED_MESSAGE =
  'Pas de souci ! Sans photo, ce plat ne compte pas pour ta série et ne rapporte pas d’XP. La prochaine fois, une petite photo et c’est validé.';
