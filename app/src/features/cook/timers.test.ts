import {
  formatDuration,
  formatRemaining,
  pauseTimer,
  remainingMs,
  resumeTimer,
  startTimer,
  timerSchema,
  timerStatus,
} from './timers';

const NOW = Date.parse('2026-10-07T18:00:00Z');

describe('minuteurs d’étape (R-05)', () => {
  it('repose sur une heure de fin absolue', () => {
    const t = startTimer(2, 300, NOW);
    expect(t.endsAt).toBe(NOW + 300_000);
    expect(remainingMs(t, NOW + 60_000)).toBe(240_000);
    expect(timerStatus(t, NOW + 60_000)).toBe('running');
  });

  it('est terminé à l’échéance et ne descend jamais sous zéro', () => {
    const t = startTimer(0, 60, NOW);
    expect(timerStatus(t, NOW + 60_000)).toBe('done');
    expect(remainingMs(t, NOW + 3_600_000)).toBe(0);
  });

  it('survit à un redémarrage : sérialisé puis relu, il continue de s’écouler', () => {
    const t = startTimer(2, 600, NOW);
    // L'app est tuée : seul l'état persisté reste. Relance 4 min plus tard.
    const reloaded = timerSchema.parse(JSON.parse(JSON.stringify(t)));
    expect(remainingMs(reloaded, NOW + 240_000)).toBe(360_000);
    // Relance après l'échéance : terminé, sans « temps négatif ».
    expect(timerStatus(reloaded, NOW + 601_000)).toBe('done');
  });

  it('se met en pause et reprend sans perdre de temps', () => {
    const t = startTimer(1, 300, NOW);
    const paused = pauseTimer(t, NOW + 100_000);
    expect(timerStatus(paused, NOW + 999_999)).toBe('paused');
    expect(remainingMs(paused, NOW + 999_999)).toBe(200_000);
    const resumed = resumeTimer(paused, NOW + 500_000);
    expect(resumed.endsAt).toBe(NOW + 700_000);
    expect(remainingMs(resumed, NOW + 600_000)).toBe(100_000);
  });

  it('formate le temps restant et la durée prévue', () => {
    expect(formatRemaining(245_000)).toBe('4:05');
    expect(formatRemaining(244_001)).toBe('4:05');
    expect(formatRemaining(3_723_000)).toBe('1:02:03');
    expect(formatRemaining(-5)).toBe('0:00');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(300)).toBe('5 min');
    expect(formatDuration(90)).toBe('1 min 30');
    expect(formatDuration(5400)).toBe('1 h 30');
    expect(formatDuration(3600)).toBe('1 h');
  });
});
