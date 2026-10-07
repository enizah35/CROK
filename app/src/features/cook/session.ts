/**
 * Session de cuisson active (R-03, R-06), telle que renvoyée par le serveur.
 */
import {
  activeCookSessionSchema,
  ingredientSchema,
  stepSchema,
  type ActiveCookSession,
} from '@crok/shared';
import { z } from 'zod';

/** R-06 : une session se reprend pendant 6 h. */
export const RESUME_WINDOW_MS = 6 * 3600 * 1000;

/** Forme de `get_active_cook_session()` : schéma partagé de @crok/shared (cookResult.ts). */
export type ActiveSession = ActiveCookSession;

/** `null` (aucune session en cours) ou une session valide ; toute autre forme est une erreur. */
export function parseActiveSession(data: unknown): ActiveSession | null {
  if (data === null || data === undefined) return null;
  return activeCookSessionSchema.parse(data);
}

/**
 * R-06 : temps restant pour reprendre la session, calculé uniquement avec les deux instants
 * fournis par le serveur (started_at, server_now) : l'horloge du téléphone n'intervient pas.
 * 0 si la session a 6 h ou plus.
 */
export function resumeWindowRemainingMs(session: ActiveSession): number {
  const startedAt = Date.parse(session.started_at);
  const serverNow = Date.parse(session.server_now);
  if (Number.isNaN(startedAt) || Number.isNaN(serverNow)) return 0;
  return Math.max(0, startedAt + RESUME_WINDOW_MS - serverNow);
}

/**
 * Session reprenable : renvoyée par le serveur ET de moins de 6 h selon le serveur. Le serveur
 * abandonne déjà les sessions de 6 h ou plus ; ce contrôle est une ceinture de sécurité.
 */
export function resumableSession(session: ActiveSession | null): ActiveSession | null {
  if (session === null) return null;
  return resumeWindowRemainingMs(session) > 0 ? session : null;
}

/** Contenu de recette utile au mode cuisine (colonnes jsonb validées). */
export const cookRecipeSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  title: z.string(),
  servings_base: z.number().int().min(1),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema).min(1),
});
export type CookRecipe = z.infer<typeof cookRecipeSchema>;
