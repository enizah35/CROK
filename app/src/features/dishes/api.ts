import {
  cookErrorCode,
  cookResultSchema,
  cookSessionTimingSchema,
  secondsUntilValidation,
  type CookErrorCode,
  type CookResult,
} from '@crok/shared';

import { supabase } from '@/lib/supabase';

/**
 * Clés TanStack Query de la progression (XP, semaine x/3, série). Préfixe partagé avec le
 * profil (tâche 1.5) : après un plat validé, on invalide `progressKeys.all`, ce qui rafraîchit
 * toute requête dont la clé commence par `['progress']`.
 */
export const progressKeys = {
  all: ['progress'] as const,
  me: () => [...progressKeys.all, 'me'] as const,
};

/** Bucket privé des photos de plats (R-09). */
export const DISHES_BUCKET = 'dishes';

/**
 * Échec d'une étape de la validation. `code` : code du serveur (docs/api-serveur.md), ou
 * `null` pour un échec réseau / une réponse inattendue, qu'on peut réessayer sans risque.
 */
export class DishSubmitError extends Error {
  constructor(
    readonly code: CookErrorCode | null,
    readonly stage: 'upload' | 'complete',
    cause?: unknown,
  ) {
    super(code ?? `${stage}_failed`, { cause });
    this.name = 'DishSubmitError';
  }
}

function isAlreadyStored(error: { message: string; statusCode?: unknown }): boolean {
  return String(error.statusCode) === '409' || /already exists/i.test(error.message);
}

/**
 * Envoie la photo dans `dishes/{uid}/{session}/{sha256}.jpg`. La RLS du stockage interdit
 * d'écraser un objet (pas d'upsert possible) : si l'objet existe déjà, c'est qu'un envoi
 * précédent du même fichier a abouti (le nom est son empreinte), on le compte comme réussi.
 */
export async function uploadDishPhoto(path: string, bytes: Uint8Array): Promise<void> {
  // Tampon exactement à la taille des octets (supabase-js en React Native attend un ArrayBuffer).
  const body = bytes.slice().buffer;
  const { error } = await supabase.storage
    .from(DISHES_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error && !isAlreadyStored(error)) throw new DishSubmitError(null, 'upload', error);
}

/**
 * Valide le plat (R-08). Idempotent côté serveur (R-10) : rappelée après un échec réseau,
 * la fonction renvoie le même résultat avec `already_completed = true`.
 */
export async function completeCookSession(input: {
  sessionId: string;
  photoPath: string;
  sha256: string;
}): Promise<CookResult> {
  const { data, error } = await supabase.rpc('complete_cook_session', {
    p_session_id: input.sessionId,
    p_photo_path: input.photoPath,
    p_photo_sha256: input.sha256,
  });
  if (error) throw new DishSubmitError(cookErrorCode(error.message), 'complete', error);
  const parsed = cookResultSchema.safeParse(data);
  if (!parsed.success) throw new DishSubmitError(null, 'complete', parsed.error);
  return parsed.data;
}

/** « Passer » (R-07) : la session se termine sans photo, sans XP ni série. */
export async function skipCookSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('cook_sessions')
    .update({ status: 'terminee_sans_photo' })
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * Attente estimée (secondes) après `too_early`, à partir de l'heure du serveur ; `null` si on
 * ne peut pas la calculer (autre session en cours, réseau…). Affichage seulement.
 */
export async function fetchValidationWait(sessionId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('get_active_cook_session');
    if (error) return null;
    const session = cookSessionTimingSchema.safeParse(data);
    if (!session.success || session.data?.id !== sessionId) return null;
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('active_min')
      .eq('id', session.data.recipe_id)
      .maybeSingle();
    if (recipeError || !recipe) return null;
    return secondsUntilValidation({
      startedAt: session.data.started_at,
      serverNow: session.data.server_now,
      activeMin: recipe.active_min,
    });
  } catch {
    return null;
  }
}
