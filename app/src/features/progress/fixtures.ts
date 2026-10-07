import type { MyProgress } from '@crok/shared';

import type { MyDish } from './api';

/** Réponse type de get_my_progress : mardi 6 octobre 2026, 10:00 à Paris. */
export const progressFixture: MyProgress = {
  lifetime_xp: 1200,
  week_start: '2026-10-05',
  week_xp: 200,
  week_dishes_count: 2,
  goal: 3,
  goal_reached: false,
  streak: 4,
  today_dishes_count: 0,
  server_now: '2026-10-06T08:00:00.123456+00:00',
};

export const dishesFixture: MyDish[] = [
  {
    id: 'dish-2',
    created_at: '2026-10-05T18:30:00+00:00',
    day_paris: '2026-10-05',
    counted: true,
    recipe: { title: 'Dahl de lentilles corail' },
  },
  {
    id: 'dish-1',
    created_at: '2025-12-31T19:00:00+00:00',
    day_paris: '2025-12-31',
    counted: false,
    recipe: null,
  },
];
