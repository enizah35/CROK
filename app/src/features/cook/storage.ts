/**
 * Persistance locale de la progression d'une cuisson (R-06) : étape courante, minuteurs et
 * copie de la recette telle qu'elle était au lancement (version figée de la session).
 * Une entrée par session ; tout est validé à la lecture.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { cookRecipeSchema } from './session';
import { timerSchema } from './timers';

const KEY_PREFIX = 'crok.cook.';

export const cookProgressSchema = z.object({
  sessionId: z.string(),
  stepIndex: z.number().int().min(0),
  timers: z.array(timerSchema),
  recipe: cookRecipeSchema.nullable(),
});
export type CookProgress = z.infer<typeof cookProgressSchema>;

export function progressKey(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}

export function emptyProgress(sessionId: string): CookProgress {
  return { sessionId, stepIndex: 0, timers: [], recipe: null };
}

/** Progression enregistrée, ou null si absente ou illisible. */
export async function loadProgress(sessionId: string): Promise<CookProgress | null> {
  const raw = await AsyncStorage.getItem(progressKey(sessionId));
  if (raw === null) return null;
  try {
    const parsed = cookProgressSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.sessionId === sessionId ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveProgress(progress: CookProgress): Promise<void> {
  await AsyncStorage.setItem(progressKey(progress.sessionId), JSON.stringify(progress));
}

/** Toutes les progressions enregistrées (pour le ménage). */
export async function listStoredProgress(): Promise<CookProgress[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KEY_PREFIX));
  const all = await Promise.all(keys.map((k) => loadProgress(k.slice(KEY_PREFIX.length))));
  return all.filter((p): p is CookProgress => p !== null);
}

export async function removeStoredKeys(exceptSessionId: string | null): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) =>
      k.startsWith(KEY_PREFIX) && (exceptSessionId === null || k !== progressKey(exceptSessionId)),
  );
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
}
