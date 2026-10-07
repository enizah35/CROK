/**
 * Minuteurs d'étape (R-05), logique pure.
 *
 * Un minuteur en marche est décrit par son heure de fin ABSOLUE (`endsAt`, ms depuis l'époque)
 * et non par un compte à rebours : il survit ainsi à la mise en arrière-plan et à l'arrêt de
 * l'app. Il est local au téléphone (aucune règle métier n'en dépend), d'où l'usage de
 * l'horloge du téléphone ici.
 */
import { z } from 'zod';

export const timerSchema = z.object({
  stepIndex: z.number().int().min(0),
  durationSec: z.number().int().positive(),
  /** Heure de fin absolue si le minuteur tourne, sinon null (en pause). */
  endsAt: z.number().nullable(),
  /** Temps restant figé quand le minuteur est en pause. */
  pausedRemainingMs: z.number().min(0).nullable(),
  /** Notification locale programmée pour l'échéance, si les notifications sont permises. */
  notificationId: z.string().nullable(),
});
export type StepTimer = z.infer<typeof timerSchema>;

export type TimerStatus = 'running' | 'paused' | 'done';

export function startTimer(stepIndex: number, durationSec: number, now: number): StepTimer {
  return {
    stepIndex,
    durationSec,
    endsAt: now + durationSec * 1000,
    pausedRemainingMs: null,
    notificationId: null,
  };
}

export function remainingMs(timer: StepTimer, now: number): number {
  if (timer.endsAt === null) return timer.pausedRemainingMs ?? 0;
  return Math.max(0, timer.endsAt - now);
}

export function timerStatus(timer: StepTimer, now: number): TimerStatus {
  if (timer.endsAt === null) return 'paused';
  return timer.endsAt <= now ? 'done' : 'running';
}

export function pauseTimer(timer: StepTimer, now: number): StepTimer {
  if (timer.endsAt === null) return timer;
  return {
    ...timer,
    endsAt: null,
    pausedRemainingMs: remainingMs(timer, now),
    notificationId: null,
  };
}

export function resumeTimer(timer: StepTimer, now: number): StepTimer {
  if (timer.endsAt !== null) return timer;
  return { ...timer, endsAt: now + (timer.pausedRemainingMs ?? 0), pausedRemainingMs: null };
}

/** Affichage « 4:05 », « 1:02:03 ». Arrondi à la seconde supérieure (jamais « 0:00 » trop tôt). */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** « 5 min », « 1 h 30 », « 45 s » : durée prévue d'un minuteur. */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  return s > 0 ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}
