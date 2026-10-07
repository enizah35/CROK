/**
 * Temps de référence de CROK (R-01, R-02).
 *
 * Une seule horloge : Europe/Paris. Une semaine va du lundi 00:00 au dimanche 23:59:59
 * (heure de Paris). Équivalents SQL : `public.week_start` et `public.day_paris`
 * (supabase/migrations), testés sur les mêmes cas dans supabase/tests/time.test.sql.
 */

export const PARIS_TIME_ZONE = 'Europe/Paris';

/** Date calendaire au format ISO `AAAA-MM-JJ`, comme une colonne Postgres `date`. */
export type IsoDate = string;

const parisFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function assertValidDate(instant: Date): void {
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError('Date invalide');
  }
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** Découpe une date calendaire de Paris en composants numériques. */
function parisParts(instant: Date): { year: number; month: number; day: number } {
  let year = 0;
  let month = 0;
  let day = 0;
  for (const part of parisFormatter.formatToParts(instant)) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
  }
  return { year, month, day };
}

/** Jour calendaire de Paris correspondant à un instant (colonne `day_paris`). */
export function dayParis(instant: Date): IsoDate {
  assertValidDate(instant);
  const { year, month, day } = parisParts(instant);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Lundi (heure de Paris) de la semaine contenant `instant` (R-02).
 * Le résultat ne dépend jamais du fuseau de l'appareil.
 */
export function weekStart(instant: Date): IsoDate {
  assertValidDate(instant);
  const { year, month, day } = parisParts(instant);
  // Arithmétique sur une date calendaire pure (UTC, sans heure) : aucun changement d'heure ici.
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (calendarDay.getUTCDay() + 6) % 7;
  calendarDay.setUTCDate(calendarDay.getUTCDate() - daysSinceMonday);
  return calendarDay.toISOString().slice(0, 10);
}
