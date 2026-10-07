/**
 * Progression locale d'une session (R-05, R-06) : étape courante et minuteurs, persistés à
 * chaque changement pour survivre à l'arrêt de l'app.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { cancelTimerNotification, scheduleTimerNotification } from './notifications';
import type { CookRecipe } from './session';
import { emptyProgress, loadProgress, saveProgress, type CookProgress } from './storage';
import { pauseTimer, resumeTimer, startTimer, type StepTimer } from './timers';

export type CookProgressApi = {
  /** null tant que l'état persisté n'est pas relu. */
  progress: CookProgress | null;
  /** Vrai si une alerte n'a pas pu être programmée (permission refusée). */
  notificationsUnavailable: boolean;
  goToStep: (stepIndex: number) => void;
  setRecipeSnapshot: (recipe: CookRecipe) => void;
  /** `recipeTitle` sert au texte de la notification. */
  startStepTimer: (stepIndex: number, durationSec: number, recipeTitle: string) => void;
  pauseStepTimer: (stepIndex: number) => void;
  resumeStepTimer: (stepIndex: number, recipeTitle: string) => void;
  resetStepTimer: (stepIndex: number) => void;
};

function withTimer(progress: CookProgress, timer: StepTimer): CookProgress {
  return {
    ...progress,
    timers: [...progress.timers.filter((t) => t.stepIndex !== timer.stepIndex), timer],
  };
}

function findTimer(progress: CookProgress | null, stepIndex: number): StepTimer | undefined {
  return progress?.timers.find((t) => t.stepIndex === stepIndex);
}

export function useCookProgress(sessionId: string): CookProgressApi {
  const [progress, setProgress] = useState<CookProgress | null>(null);
  const [notificationsUnavailable, setNotificationsUnavailable] = useState(false);
  // Dernière valeur connue, pour les callbacks asynchrones (programmation des alertes).
  const latest = useRef<CookProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadProgress(sessionId)
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        const initial = stored ?? emptyProgress(sessionId);
        latest.current = initial;
        setProgress(initial);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const update = useCallback((fn: (p: CookProgress) => CookProgress) => {
    const current = latest.current;
    if (current === null) return;
    const next = fn(current);
    latest.current = next;
    setProgress(next);
    void saveProgress(next).catch(() => undefined);
  }, []);

  /** Programme l'alerte d'un minuteur en marche et mémorise son identifiant. */
  const scheduleFor = useCallback(
    (timer: StepTimer, recipeTitle: string) => {
      const { endsAt, stepIndex } = timer;
      if (endsAt === null) return;
      void scheduleTimerNotification(endsAt, recipeTitle, stepIndex + 1).then((id) => {
        if (id === null) {
          setNotificationsUnavailable(true);
          return;
        }
        const still = findTimer(latest.current, stepIndex);
        if (still?.endsAt === endsAt) {
          update((p) => withTimer(p, { ...still, notificationId: id }));
        } else {
          // Minuteur annulé ou mis en pause entre-temps.
          void cancelTimerNotification(id);
        }
      });
    },
    [update],
  );

  const goToStep = useCallback(
    (stepIndex: number) => update((p) => ({ ...p, stepIndex: Math.max(0, stepIndex) })),
    [update],
  );

  const setRecipeSnapshot = useCallback(
    (recipe: CookRecipe) => update((p) => ({ ...p, recipe })),
    [update],
  );

  const startStepTimer = useCallback(
    (stepIndex: number, durationSec: number, recipeTitle: string) => {
      void cancelTimerNotification(findTimer(latest.current, stepIndex)?.notificationId ?? null);
      const timer = startTimer(stepIndex, durationSec, Date.now());
      update((p) => withTimer(p, timer));
      scheduleFor(timer, recipeTitle);
    },
    [scheduleFor, update],
  );

  const pauseStepTimer = useCallback(
    (stepIndex: number) => {
      const timer = findTimer(latest.current, stepIndex);
      if (!timer) return;
      void cancelTimerNotification(timer.notificationId);
      update((p) => withTimer(p, pauseTimer(timer, Date.now())));
    },
    [update],
  );

  const resumeStepTimer = useCallback(
    (stepIndex: number, recipeTitle: string) => {
      const timer = findTimer(latest.current, stepIndex);
      if (!timer) return;
      const resumed = resumeTimer(timer, Date.now());
      update((p) => withTimer(p, resumed));
      scheduleFor(resumed, recipeTitle);
    },
    [scheduleFor, update],
  );

  const resetStepTimer = useCallback(
    (stepIndex: number) => {
      void cancelTimerNotification(findTimer(latest.current, stepIndex)?.notificationId ?? null);
      update((p) => ({ ...p, timers: p.timers.filter((t) => t.stepIndex !== stepIndex) }));
    },
    [update],
  );

  return {
    progress,
    notificationsUnavailable,
    goToStep,
    setRecipeSnapshot,
    startStepTimer,
    pauseStepTimer,
    resumeStepTimer,
    resetStepTimer,
  };
}
