import { describe, expect, it } from 'vitest';

import {
  COOK_ERROR_CODES,
  activeCookSessionSchema,
  cookErrorCode,
  cookErrorView,
  cookResultSchema,
  dishPhotoPath,
  formatWait,
  secondsUntilValidation,
} from './cookResult';

const result = {
  dish_id: '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d',
  counted: true,
  xp_awarded: 100,
  week_start: '2026-10-05',
  week_dishes_count: 3,
  goal_reached: true,
  streak: 1,
  lifetime_xp: 300,
  already_completed: false,
};

describe('cookResultSchema', () => {
  it('accepte la réponse documentée de complete_cook_session', () => {
    expect(cookResultSchema.parse(result)).toEqual(result);
  });

  it('refuse une réponse incomplète ou mal typée', () => {
    expect(cookResultSchema.safeParse({ ...result, counted: 'yes' }).success).toBe(false);
    expect(cookResultSchema.safeParse({ ...result, xp_awarded: -100 }).success).toBe(false);
    expect(cookResultSchema.safeParse({ ...result, week_start: '05/10/2026' }).success).toBe(false);
    expect(cookResultSchema.safeParse({ ...result, already_completed: undefined }).success).toBe(
      false,
    );
    expect(cookResultSchema.safeParse(null).success).toBe(false);
  });
});

describe('activeCookSessionSchema', () => {
  it('accepte la forme de get_active_cook_session (null admis via nullable)', () => {
    expect(activeCookSessionSchema.nullable().parse(null)).toBeNull();
    const session = {
      id: '0b8a6f4e-1c2d-4e3f-8a9b-0c1d2e3f4a5b',
      recipe_id: '1c9b7a5f-2d3e-4f40-9b0c-1d2e3f4a5b6c',
      recipe_version: 1,
      servings: 2,
      started_at: '2026-10-07T10:00:00+00:00',
      server_now: '2026-10-07T10:42:00.35298+00:00',
    };
    expect(activeCookSessionSchema.parse(session)).toEqual(session);
    expect(() => activeCookSessionSchema.parse({ ...session, servings: 7 })).toThrow();
  });
});

describe('cookErrorCode', () => {
  it('reconnaît chaque code du serveur', () => {
    for (const code of COOK_ERROR_CODES) expect(cookErrorCode(code)).toBe(code);
  });

  it('renvoie null pour un échec réseau ou un message inconnu', () => {
    expect(cookErrorCode('TypeError: Network request failed')).toBeNull();
    expect(cookErrorCode(undefined)).toBeNull();
    expect(cookErrorCode(42)).toBeNull();
  });
});

describe('cookErrorView', () => {
  it('a un texte et une action pour chaque code et pour le réseau', () => {
    for (const code of [...COOK_ERROR_CODES, null]) {
      const view = cookErrorView(code);
      expect(view.title.length).toBeGreaterThan(0);
      expect(view.message.length).toBeGreaterThan(0);
    }
  });

  it('réseau, too_early et photo_missing se réessaient avec la même photo (R-10)', () => {
    expect(cookErrorView(null).action).toBe('retry');
    expect(cookErrorView('too_early').action).toBe('retry');
    expect(cookErrorView('photo_missing').action).toBe('retry');
  });

  it('duplicate_photo demande une nouvelle photo (R-12)', () => {
    expect(cookErrorView('duplicate_photo').action).toBe('retake');
  });

  it('session expirée, terminée ou introuvable : retour aux recettes (R-06)', () => {
    expect(cookErrorView('session_expired').action).toBe('leave');
    expect(cookErrorView('session_not_running').action).toBe('leave');
    expect(cookErrorView('session_not_found').action).toBe('leave');
  });

  it('too_early dit combien de temps encore si on le sait (R-09)', () => {
    expect(cookErrorView('too_early', { waitSeconds: 125 }).message).toContain('dans 3 min');
    expect(cookErrorView('too_early', { waitSeconds: null }).message).toContain(
      'C’est un peu rapide',
    );
    expect(cookErrorView('too_early', { waitSeconds: 0 }).message).toContain('un peu rapide');
  });
});

describe('formatWait', () => {
  it.each([
    [10, 'moins d’une minute'],
    [60, '1 min'],
    [61, '2 min'],
    [3540, '59 min'],
    [3600, '1 h'],
    [3601, '1 h 01'],
    [5400, '1 h 30'],
  ])('%i s → %s', (seconds, label) => {
    expect(formatWait(seconds)).toBe(label);
  });
});

describe('secondsUntilValidation (R-09, affichage seulement)', () => {
  const startedAt = '2026-10-07T10:00:00+00:00';
  it('5 min minimum pour une recette courte', () => {
    expect(
      secondsUntilValidation({ startedAt, serverNow: '2026-10-07T10:02:00+00:00', activeMin: 5 }),
    ).toBe(180);
  });
  it('40 % du temps actif pour une recette longue', () => {
    // 40 min actives → 16 min ; 10 min écoulées → 6 min.
    expect(
      secondsUntilValidation({ startedAt, serverNow: '2026-10-07T10:10:00+00:00', activeMin: 40 }),
    ).toBe(360);
  });
  it('0 une fois le délai passé, et heure du serveur avec un autre fuseau', () => {
    expect(
      secondsUntilValidation({ startedAt, serverNow: '2026-10-07T12:20:00+02:00', activeMin: 40 }),
    ).toBe(0);
  });
});

describe('divers', () => {
  it('dishPhotoPath range la photo dans {uid}/{session}/', () => {
    expect(dishPhotoPath('u', 's', 'abc')).toBe('u/s/abc.jpg');
  });
});
