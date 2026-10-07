import type { MyProgress, PepinEtat } from '@crok/shared';
import { render, screen } from '@testing-library/react-native';

import { progressFixture } from './fixtures';
import { ProgressSummary } from './ProgressSummary';

async function renderSummary(patch: Partial<MyProgress> = {}) {
  await render(<ProgressSummary progress={{ ...progressFixture, ...patch }} />);
}

describe('ProgressSummary', () => {
  it('affiche les valeurs du serveur telles quelles', async () => {
    await renderSummary();
    expect(screen.getByTestId('progress-lifetime-xp')).toHaveTextContent('1 200 XP');
    expect(screen.getByTestId('progress-week-xp')).toHaveTextContent('+200 XP');
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min: 0, max: 3, now: 2 });
    expect(screen.getByTestId('progress-streak')).toHaveTextContent('4 semaines');
    expect(screen.getByTestId('progress-today')).toHaveTextContent('Aucun plat pour l’instant');
    // Mardi (heure de Paris d'après server_now) : 6 jours restants, aujourd'hui compris.
    expect(screen.getByTestId('progress-days-left')).toHaveTextContent(
      'Encore 6 jours cette semaine',
    );
  });

  it('ne recalcule pas le compteur : un serveur à 1/3 avec 3 plats du jour affiche 1/3', async () => {
    await renderSummary({ week_dishes_count: 1, today_dishes_count: 3 });
    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ min: 0, max: 3, now: 1 });
    expect(screen.getByTestId('progress-today')).toHaveTextContent('3 plats');
  });

  // R-30, sans le défi (fete).
  const cases: [string, Partial<MyProgress>, PepinEtat][] = [
    ['plat validé aujourd’hui', { today_dishes_count: 1 }, 'fier'],
    [
      'plat du jour non compté, 0/3 un jeudi',
      {
        today_dishes_count: 1,
        week_dishes_count: 0,
        server_now: '2026-10-08T10:00:00+00:00',
      },
      'fier',
    ],
    ['3/3', { week_dishes_count: 3, goal_reached: true }, 'en_feu'],
    ['2/3', { week_dishes_count: 2 }, 'motive'],
    ['1/3', { week_dishes_count: 1 }, 'motive'],
    ['0/3 un jeudi', { week_dishes_count: 0, server_now: '2026-10-07T22:00:00+00:00' }, 'affame'],
    [
      '0/3 un mercredi',
      {
        week_dishes_count: 0,
        server_now: '2026-10-07T21:59:59+00:00',
      },
      'neutre',
    ],
  ];

  it.each(cases)('Pépin pour « %s » : %s', async (_label, patch, etat) => {
    await renderSummary(patch);
    expect(screen.getByTestId(`pepin-${etat}`)).toBeOnTheScreen();
  });

  it('dimanche : dernier jour de la semaine', async () => {
    await renderSummary({ server_now: '2026-10-11T21:59:00+00:00' });
    expect(screen.getByTestId('progress-days-left')).toHaveTextContent(
      'Dernier jour de la semaine',
    );
  });
});
