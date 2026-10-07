import { cookErrorView, dishPhotoPath, type CookErrorView, type CookResult } from '@crok/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { progressKeys } from '@/features/progress/api';

import {
  DishSubmitError,
  completeCookSession,
  fetchValidationWait,
  skipCookSession,
  uploadDishPhoto,
} from './api';
import { PhotoPreparationError, preparePhoto } from './preparePhoto';

export type CapturedPhoto = { uri: string; width: number };

export type SubmissionState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; error: CookErrorView }
  | { phase: 'done'; result: CookResult }
  | { phase: 'skipping' }
  | { phase: 'skip_error' }
  | { phase: 'skipped' };

type Prepared = { sourceUri: string; bytes: Uint8Array<ArrayBuffer>; sha256: string; path: string };

const PREPARATION_ERROR: CookErrorView = {
  title: 'Photo illisible',
  message: 'On n’a pas réussi à préparer ta photo. Reprends-la, ça devrait passer.',
  action: 'retake',
};

/**
 * Envoi de la photo puis validation du plat, rejouable sans doublon (R-10) :
 * - la photo préparée (octets, empreinte, chemin) est gardée pour les réessais ;
 * - un envoi réussi n'est pas refait, et le chemin est l'empreinte du fichier ;
 * - `complete_cook_session` est idempotent : `already_completed` est un succès ;
 * - un appel à la fois : un double appui pendant l'envoi est ignoré.
 */
export function useDishSubmission(sessionId: string, userId: string) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SubmissionState>({ phase: 'idle' });
  const [completionAttempted, setCompletionAttempted] = useState(false);
  const busy = useRef(false);
  const prepared = useRef<Prepared | null>(null);
  const uploadedPath = useRef<string | null>(null);

  const submit = useCallback(
    async (photo: CapturedPhoto) => {
      if (busy.current) return;
      busy.current = true;
      setState({ phase: 'submitting' });
      try {
        let current = prepared.current;
        if (current?.sourceUri !== photo.uri) {
          const { bytes, sha256 } = await preparePhoto(photo.uri, photo.width);
          current = {
            sourceUri: photo.uri,
            bytes,
            sha256,
            path: dishPhotoPath(userId, sessionId, sha256),
          };
          prepared.current = current;
        }
        if (uploadedPath.current !== current.path) {
          await uploadDishPhoto(current.path, current.bytes);
          uploadedPath.current = current.path;
        }
        setCompletionAttempted(true);
        const result = await completeCookSession({
          sessionId,
          photoPath: current.path,
          sha256: current.sha256,
        });
        void queryClient.invalidateQueries({ queryKey: progressKeys.all });
        setState({ phase: 'done', result });
      } catch (error) {
        if (error instanceof PhotoPreparationError) {
          prepared.current = null;
          setState({ phase: 'error', error: PREPARATION_ERROR });
          return;
        }
        const code = error instanceof DishSubmitError ? error.code : null;
        // Le serveur ne trouve pas la photo : on la renverra au prochain essai.
        if (code === 'photo_missing') uploadedPath.current = null;
        const waitSeconds = code === 'too_early' ? await fetchValidationWait(sessionId) : null;
        setState({ phase: 'error', error: cookErrorView(code, { waitSeconds }) });
      } finally {
        busy.current = false;
      }
    },
    [queryClient, sessionId, userId],
  );

  const skip = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: 'skipping' });
    try {
      await skipCookSession(sessionId);
      setState({ phase: 'skipped' });
    } catch {
      setState({ phase: 'skip_error' });
    } finally {
      busy.current = false;
    }
  }, [sessionId]);

  /** Après « Reprendre » : on efface l'erreur affichée (la photo envoyée reste en cache). */
  const clearError = useCallback(() => {
    setState((s) => (s.phase === 'error' || s.phase === 'skip_error' ? { phase: 'idle' } : s));
  }, []);

  return { state, submit, skip, clearError, completionAttempted };
}
