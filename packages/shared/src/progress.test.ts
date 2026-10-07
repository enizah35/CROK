import { describe, expect, it } from 'vitest';

import {
  InvalidServerResponseError,
  daysLeftInWeek,
  daysLeftLabel,
  formatParisDay,
  formatXp,
  parisWeekday,
  parseMyProgress,
  parseServerInstant,
  pepinEtatAfterDish,
  pepinEtatFromProgress,
  streakLabel,
  todayDishesLabel,
  type MyProgress,
} from './progress';

// Semaine du lundi 5 octobre 2026 (heure d'été, Paris = UTC+2).
const base: MyProgress = {
  lifetime_xp: 300,
  week_start: '2026-10-05',
  week_xp: 0,
  week_dishes_count: 0,
  goal: 3,
  goal_reached: false,
  streak: 0,
  today_dishes_count: 0,
  server_now: '2026-10-06T08:00:00.123456+00:00', // mardi
};

const at = (server_now: string, patch: Partial<MyProgress> = {}): MyProgress => ({
  ...base,
  ...patch,
  server_now,
});

describe('parseMyProgress', () => {
  it('accepte la réponse documentée dans docs/api-serveur.md', () => {
    const raw = {
      lifetime_xp: 300,
      week_start: '2026-10-12',
      week_xp: 300,
      week_dishes_count: 3,
      goal: 3,
      goal_reached: true,
      streak: 1,
      today_dishes_count: 1,
      server_now: '2026-10-15T08:00:00+00:00',
    };
    expect(parseMyProgress(raw)).toEqual(raw);
  });

  it('accepte un horodatage Postgres avec microsecondes et décalage de Paris', () => {
    expect(parseMyProgress(at('2026-10-15T10:00:00.654321+02:00')).server_now).toBe(
      '2026-10-15T10:00:00.654321+02:00',
    );
  });

  it.each([
    ['null (profil absent)', null],
    ['un champ manquant', { ...base, streak: undefined }],
    ['un compteur négatif', { ...base, week_dishes_count: -1 }],
    ['un compteur non entier', { ...base, lifetime_xp: 1.5 }],
    ['un nombre en texte', { ...base, lifetime_xp: '300' }],
    ['une date de semaine mal formée', { ...base, week_start: '05/10/2026' }],
    ['un instant sans fuseau', { ...base, server_now: '2026-10-06T08:00:00' }],
    ['un objectif nul', { ...base, goal: 0 }],
  ])('refuse %s', (_label, raw) => {
    expect(() => parseMyProgress(raw)).toThrow(InvalidServerResponseError);
  });
});

describe('parseServerInstant', () => {
  it('tronque les microsecondes', () => {
    expect(parseServerInstant('2026-10-06T08:00:00.123456+00:00').toISOString()).toBe(
      '2026-10-06T08:00:00.123Z',
    );
  });

  it('respecte le décalage horaire', () => {
    expect(parseServerInstant('2026-10-06T10:00:00+02:00').toISOString()).toBe(
      '2026-10-06T08:00:00.000Z',
    );
  });

  it('refuse un texte illisible', () => {
    expect(() => parseServerInstant('demain')).toThrow(RangeError);
  });
});

describe('parisWeekday et daysLeftInWeek (R-01)', () => {
  it('compte lundi = 7 jours restants … dimanche = 1', () => {
    expect(daysLeftInWeek(new Date('2026-10-05T10:00:00Z'))).toBe(7); // lundi
    expect(daysLeftInWeek(new Date('2026-10-07T10:00:00Z'))).toBe(5); // mercredi
    expect(daysLeftInWeek(new Date('2026-10-11T10:00:00Z'))).toBe(1); // dimanche
  });

  it('bascule au lundi 00:00 heure de Paris, pas à minuit UTC ni à minuit local', () => {
    // Dimanche 11 octobre 23:59:59 à Paris = 21:59:59Z.
    expect(parisWeekday(new Date('2026-10-11T21:59:59Z'))).toBe(7);
    expect(daysLeftInWeek(new Date('2026-10-11T21:59:59Z'))).toBe(1);
    // Lundi 12 octobre 00:00 à Paris = 22:00Z le dimanche.
    expect(parisWeekday(new Date('2026-10-11T22:00:00Z'))).toBe(1);
    expect(daysLeftInWeek(new Date('2026-10-11T22:00:00Z'))).toBe(7);
  });

  it('gère l’heure d’hiver (UTC+1)', () => {
    // Dimanche 1er février 23:59 à Paris = 22:59Z ; lundi 00:00 = 23:00Z.
    expect(daysLeftInWeek(new Date('2026-02-01T22:59:00Z'))).toBe(1);
    expect(daysLeftInWeek(new Date('2026-02-01T23:00:00Z'))).toBe(7);
  });

  it('gère le dimanche du retour à l’heure d’hiver (25 octobre 2026)', () => {
    expect(parisWeekday(new Date('2026-10-25T00:30:00Z'))).toBe(7); // 02:30 CEST
    expect(parisWeekday(new Date('2026-10-25T22:59:59Z'))).toBe(7); // 23:59:59 CET
    expect(parisWeekday(new Date('2026-10-25T23:00:00Z'))).toBe(1); // lundi 00:00 CET
  });
});

describe('libellés', () => {
  it('jours restants', () => {
    expect(daysLeftLabel(7)).toBe('Encore 7 jours cette semaine');
    expect(daysLeftLabel(2)).toBe('Encore 2 jours cette semaine');
    expect(daysLeftLabel(1)).toBe('Dernier jour de la semaine');
  });

  it('série (R-17)', () => {
    expect(streakLabel(0)).toBe('Pas encore de série');
    expect(streakLabel(1)).toBe('1 semaine');
    expect(streakLabel(12)).toBe('12 semaines');
  });

  it('plats du jour', () => {
    expect(todayDishesLabel(0)).toBe('Aucun plat pour l’instant');
    expect(todayDishesLabel(1)).toBe('1 plat');
    expect(todayDishesLabel(3)).toBe('3 plats');
  });

  it('XP avec séparateur de milliers', () => {
    expect(formatXp(0)).toBe('0 XP');
    expect(formatXp(300)).toBe('300 XP');
    expect(formatXp(1200)).toBe('1 200 XP');
    expect(formatXp(1234567)).toBe('1 234 567 XP');
  });

  it('jour calendaire en français, sans dépendre du fuseau', () => {
    expect(formatParisDay('2026-10-07')).toBe('mercredi 7 octobre');
    expect(formatParisDay('2026-08-01', 2026)).toBe('samedi 1 août');
    expect(formatParisDay('2025-12-31', 2026)).toBe('mercredi 31 décembre 2025');
    expect(() => formatParisDay('7 octobre')).toThrow(RangeError);
  });
});

describe('pepinEtatFromProgress (R-30, sans le défi)', () => {
  it('fier dès qu’un plat est validé aujourd’hui, avant toute autre règle', () => {
    expect(pepinEtatFromProgress({ ...base, today_dishes_count: 1, week_dishes_count: 1 })).toBe(
      'fier',
    );
    expect(
      pepinEtatFromProgress({
        ...base,
        today_dishes_count: 2,
        week_dishes_count: 3,
        goal_reached: true,
      }),
    ).toBe('fier');
  });

  it('fier aussi pour un plat validé mais non compté (R-11), même à 0/3 un jeudi', () => {
    const thursday = at('2026-10-08T10:00:00+00:00', { today_dishes_count: 1 });
    expect(pepinEtatFromProgress(thursday)).toBe('fier');
  });

  it('en feu à 3/3', () => {
    expect(pepinEtatFromProgress({ ...base, week_dishes_count: 3, goal_reached: true })).toBe(
      'en_feu',
    );
    expect(pepinEtatFromProgress({ ...base, week_dishes_count: 4, goal_reached: true })).toBe(
      'en_feu',
    );
  });

  it('motivé à 1 ou 2 sur 3, même en fin de semaine', () => {
    expect(pepinEtatFromProgress({ ...base, week_dishes_count: 1 })).toBe('motive');
    expect(pepinEtatFromProgress(at('2026-10-11T20:00:00+00:00', { week_dishes_count: 2 }))).toBe(
      'motive',
    );
  });

  it('neutre à 0/3 du lundi au mercredi 23:59:59 (Paris)', () => {
    expect(pepinEtatFromProgress(at('2026-10-04T22:00:00+00:00'))).toBe('neutre'); // lundi 00:00
    expect(pepinEtatFromProgress(at('2026-10-07T21:59:59.999999+00:00'))).toBe('neutre');
  });

  it('affamé à 0/3 dès le jeudi 00:00 (Paris) et jusqu’au dimanche 23:59', () => {
    expect(pepinEtatFromProgress(at('2026-10-07T22:00:00+00:00'))).toBe('affame'); // jeudi 00:00
    expect(pepinEtatFromProgress(at('2026-10-08T00:00:00+02:00'))).toBe('affame'); // même instant
    expect(pepinEtatFromProgress(at('2026-10-11T21:59:00+00:00'))).toBe('affame'); // dim. 23:59
  });

  it('repart à neutre le lundi 00:00 suivant (nouvelle semaine à 0/3)', () => {
    expect(
      pepinEtatFromProgress(at('2026-10-11T22:00:00+00:00', { week_start: '2026-10-12' })),
    ).toBe('neutre');
  });

  it('jeudi 00:00 en heure d’hiver (UTC+1)', () => {
    // Jeudi 5 février 2026 00:00 à Paris = mercredi 4 février 23:00Z.
    expect(pepinEtatFromProgress(at('2026-02-04T22:59:59+00:00'))).toBe('neutre');
    expect(pepinEtatFromProgress(at('2026-02-04T23:00:00+00:00'))).toBe('affame');
  });
});

describe('pepinEtatAfterDish (écran de récompense, R-30)', () => {
  it('fier après un plat validé, même quand il fait atteindre 3/3 (fier avant en feu)', () => {
    expect(pepinEtatAfterDish({ goal_reached: false, week_dishes_count: 1 })).toBe('fier');
    expect(pepinEtatAfterDish({ goal_reached: true, week_dishes_count: 3 })).toBe('fier');
  });
});
