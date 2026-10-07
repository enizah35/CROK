import { describe, expect, it } from 'vitest';

import { dayParis, weekStart } from './time';

// Rappels 2026 : passage à l'heure d'été le dimanche 29 mars (02:00 CET -> 03:00 CEST),
// retour à l'heure d'hiver le dimanche 25 octobre (03:00 CEST -> 02:00 CET).

describe('environnement de test', () => {
  it("tourne dans un fuseau différent de Paris pour piéger l'usage de l'heure locale", () => {
    // America/Los_Angeles : UTC-7 en juillet, alors que Paris est à UTC+2.
    expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(420);
  });
});

describe('weekStart (R-01, R-02)', () => {
  it('renvoie le lundi pour chaque jour d’une semaine ordinaire', () => {
    expect(weekStart(new Date('2026-10-05T10:00:00Z'))).toBe('2026-10-05'); // lundi
    expect(weekStart(new Date('2026-10-07T10:00:00Z'))).toBe('2026-10-05'); // mercredi
    expect(weekStart(new Date('2026-10-11T10:00:00Z'))).toBe('2026-10-05'); // dimanche
  });

  it('bascule exactement au lundi 00:00 heure de Paris (heure d’hiver, UTC+1)', () => {
    // Dimanche 1er février 23:59:59 à Paris = 22:59:59Z.
    expect(weekStart(new Date('2026-02-01T22:59:59Z'))).toBe('2026-01-26');
    // Lundi 2 février 00:00 à Paris = 23:00Z la veille.
    expect(weekStart(new Date('2026-02-01T23:00:00Z'))).toBe('2026-02-02');
  });

  it('bascule exactement au lundi 00:00 heure de Paris (heure d’été, UTC+2)', () => {
    // Dimanche 5 juillet 23:59:59 à Paris = 21:59:59Z.
    expect(weekStart(new Date('2026-07-05T21:59:59Z'))).toBe('2026-06-29');
    // Lundi 6 juillet 00:00 à Paris = 22:00Z le dimanche en UTC.
    expect(weekStart(new Date('2026-07-05T22:00:00Z'))).toBe('2026-07-06');
  });

  describe('passage à l’heure d’été (dimanche 29 mars 2026)', () => {
    it('reste dans la semaine du 23 mars avant, pendant et après le saut de 02:00', () => {
      expect(weekStart(new Date('2026-03-29T00:59:59Z'))).toBe('2026-03-23'); // 01:59:59 CET
      expect(weekStart(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-23'); // 03:00:00 CEST
      expect(weekStart(new Date('2026-03-29T21:59:59Z'))).toBe('2026-03-23'); // 23:59:59 CEST
    });

    it('passe au lundi 30 mars à minuit, déjà en heure d’été', () => {
      expect(weekStart(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30'); // 00:00 CEST
    });
  });

  describe('retour à l’heure d’hiver (dimanche 25 octobre 2026)', () => {
    it('reste dans la semaine du 19 octobre pendant l’heure répétée', () => {
      expect(weekStart(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-19'); // 02:30 CEST
      expect(weekStart(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-19'); // 02:30 CET
    });

    it('bascule au lundi 26 octobre à minuit heure d’hiver, pas une heure plus tôt', () => {
      // 23:00Z à 23:59:59 Z la veille : dimanche 23:xx CET encore.
      expect(weekStart(new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-19');
      expect(weekStart(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26'); // 00:00 CET
    });
  });

  it('gère le changement d’année', () => {
    expect(weekStart(new Date('2026-12-31T12:00:00Z'))).toBe('2026-12-28'); // jeudi
    expect(weekStart(new Date('2027-01-03T12:00:00Z'))).toBe('2026-12-28'); // dimanche
    expect(weekStart(new Date('2027-01-03T23:00:00Z'))).toBe('2027-01-04'); // lundi 00:00 CET
  });

  it('gère une année bissextile', () => {
    expect(weekStart(new Date('2028-02-29T12:00:00Z'))).toBe('2028-02-28'); // mardi
    expect(weekStart(new Date('2028-03-05T12:00:00Z'))).toBe('2028-02-28'); // dimanche
  });

  it('refuse une date invalide', () => {
    expect(() => weekStart(new Date('pas une date'))).toThrow(RangeError);
  });
});

describe('dayParis', () => {
  it('donne le jour calendaire de Paris, pas celui de l’UTC ni du téléphone', () => {
    expect(dayParis(new Date('2026-07-05T22:30:00Z'))).toBe('2026-07-06');
    expect(dayParis(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
    expect(dayParis(new Date('2026-01-15T22:59:59Z'))).toBe('2026-01-15');
  });

  it('refuse une date invalide', () => {
    expect(() => dayParis(new Date(Number.NaN))).toThrow(RangeError);
  });
});
