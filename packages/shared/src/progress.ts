/**
 * Progression du joueur (R-16 à R-18) et état de Pépin (R-30), tâche 1.5.
 *
 * Le serveur fait foi : `get_my_progress()` (docs/api-serveur.md) renvoie XP, compteur x/3,
 * série et plats du jour. Ce module ne recalcule aucune de ces valeurs : il valide la réponse
 * et fournit des fonctions d'affichage (libellés, jours restants, état de Pépin) dérivées de
 * cette réponse et de l'heure serveur `server_now`, jamais de l'horloge du téléphone (R-01).
 */
import { z } from 'zod';

import { dayParis, type IsoDate } from './time';

/** États de Pépin (R-30), du plus au moins prioritaire hors `neutre`. */
export const PEPIN_ETATS = ['neutre', 'motive', 'affame', 'en_feu', 'fier', 'fete'] as const;
export type PepinEtat = (typeof PEPIN_ETATS)[number];

/** Objectif hebdomadaire (R-16). Le serveur le renvoie aussi dans `goal`, qui fait foi. */
export const WEEKLY_GOAL = 3;

const count = z.number().int().nonnegative();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date AAAA-MM-JJ attendue');

/** Réponse de `get_my_progress()` (docs/api-serveur.md). */
export const myProgressSchema = z.object({
  lifetime_xp: count,
  week_start: isoDate,
  week_xp: count,
  week_dishes_count: count,
  goal: z.number().int().positive(),
  goal_reached: z.boolean(),
  streak: count,
  today_dishes_count: count,
  // timestamptz sérialisé par Postgres : « 2026-10-15T08:00:00.123456+00:00 ».
  server_now: z.iso.datetime({ offset: true }),
});
export type MyProgress = z.infer<typeof myProgressSchema>;

/** Erreur levée quand la réponse du serveur ne respecte pas le contrat. */
export class InvalidServerResponseError extends Error {
  constructor(what: string, cause?: unknown) {
    super(`Réponse serveur invalide : ${what}`);
    this.name = 'InvalidServerResponseError';
    if (cause !== undefined) this.cause = cause;
  }
}

/** Valide la réponse brute (`Json`) de `get_my_progress()`. */
export function parseMyProgress(raw: unknown): MyProgress {
  const parsed = myProgressSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidServerResponseError('get_my_progress', parsed.error);
  return parsed.data;
}

/**
 * Convertit un horodatage serveur en Date. Les fractions de seconde au-delà de la milliseconde
 * (Postgres en donne 6 chiffres) sont tronquées : tous les moteurs JS ne les acceptent pas.
 */
export function parseServerInstant(value: string): Date {
  const normalized = value.replace(/(\.\d{3})\d+/, '$1');
  const instant = new Date(normalized);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Horodatage invalide : ${value}`);
  return instant;
}

/** Jour de la semaine à Paris, 1 = lundi … 7 = dimanche (R-01). */
export function parisWeekday(instant: Date): number {
  const [year, month, day] = dayParis(instant).split('-').map(Number);
  const utcDay = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/**
 * Jours restants dans la semaine en cours, aujourd'hui compris (R-01 : la semaine finit le
 * dimanche à 23:59:59, heure de Paris). Lundi : 7 ; dimanche : 1.
 */
export function daysLeftInWeek(serverNow: Date): number {
  return 8 - parisWeekday(serverNow);
}

/** Libellé des jours restants, sans pression. */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 1) return 'Dernier jour de la semaine';
  return `Encore ${daysLeft} jours cette semaine`;
}

/** Libellé de la série hebdomadaire (R-17). */
export function streakLabel(streak: number): string {
  if (streak <= 0) return 'Pas encore de série';
  return streak === 1 ? '1 semaine' : `${streak} semaines`;
}

/** Libellé des plats validés aujourd'hui, comptés ou non. */
export function todayDishesLabel(n: number): string {
  if (n <= 0) return 'Aucun plat pour l’instant';
  return n === 1 ? '1 plat' : `${n} plats`;
}

/** XP formatée à la française : « 1 200 XP » (espace fine insécable). */
export function formatXp(xp: number): string {
  const digits = String(Math.trunc(xp)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${digits} XP`;
}

/** Jeudi : à partir de ce jour, 0/3 rend Pépin affamé (R-30). */
const AFFAME_FROM_WEEKDAY = 4;

/**
 * État de Pépin dérivé de la progression (R-30), sans la partie défi (`fete`, tâche 2.5/3.1).
 * Priorités : `fier` > `en_feu` > `motive` > `affame` > `neutre`.
 *
 * Décision : un plat validé mais non compté (R-11 : au-delà de 2 par jour ou recette déjà
 * comptée aujourd'hui) rend quand même Pépin `fier`. R-30 parle de « plat validé », et le
 * serveur compte ces plats dans `today_dishes_count` ; cuisiner reste une victoire même sans XP.
 *
 * `en_feu` suit `goal_reached` du serveur (3/3), `motive` 1 ou 2 plats comptés sur l'objectif,
 * `affame` 0 plat compté à partir du jeudi 00:00 (heure de Paris, d'après `server_now`).
 */
export function pepinEtatFromProgress(progress: MyProgress): PepinEtat {
  if (progress.today_dishes_count > 0) return 'fier';
  if (progress.goal_reached) return 'en_feu';
  if (progress.week_dishes_count > 0) return 'motive';
  const weekday = parisWeekday(parseServerInstant(progress.server_now));
  if (weekday >= AFFAME_FROM_WEEKDAY) return 'affame';
  return 'neutre';
}

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * Date calendaire lisible (« mardi 7 octobre »), l'année ajoutée si elle diffère de
 * `currentYear`. Calcul sur la date pure, indépendant du fuseau de l'appareil et sans Intl
 * (incomplet sur certains moteurs mobiles).
 */
export function formatParisDay(day: IsoDate, currentYear?: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError(`Date invalide : ${day}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  const base = `${WEEKDAYS_FR[weekday] ?? ''} ${date} ${MONTHS_FR[month - 1] ?? ''}`;
  return currentYear !== undefined && currentYear !== year ? `${base} ${year}` : base;
}
