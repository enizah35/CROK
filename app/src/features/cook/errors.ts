/** Messages d'erreur du mode cuisine, en français et sans culpabiliser. */

type ErrorLike = { code?: unknown; message?: unknown };

const NETWORK_MESSAGE = 'Pas de connexion. Vérifie ton réseau et réessaie.';

export function cookErrorMessage(error: unknown): string {
  const e: ErrorLike = typeof error === 'object' && error !== null ? (error as ErrorLike) : {};
  if (typeof e.message === 'string' && /network request failed|failed to fetch/i.test(e.message)) {
    return NETWORK_MESSAGE;
  }
  // Trigger cook_sessions_before_insert : recette absente ou non publiée.
  if (e.code === 'P0002') return 'Cette recette n’est plus disponible.';
  if (e.code === '42501') return 'Ta session a expiré. Reconnecte-toi.';
  return 'Un problème est survenu. Réessaie dans un instant.';
}
