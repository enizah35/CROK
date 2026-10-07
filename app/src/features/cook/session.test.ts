import {
  RESUME_WINDOW_MS,
  parseActiveSession,
  resumableSession,
  resumeWindowRemainingMs,
} from './session';
import { T0, activeSession } from './testUtils';

describe('session active (R-06)', () => {
  it('null du serveur : aucune session', () => {
    expect(parseActiveSession(null)).toBeNull();
    expect(resumableSession(null)).toBeNull();
  });

  it('refuse une réponse mal formée', () => {
    expect(() => parseActiveSession({ id: 'x' })).toThrow();
  });

  it('calcule la fenêtre de 6 h avec started_at et server_now, pas avec l’horloge du téléphone', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(T0 + 48 * 3600 * 1000);
    try {
      const s = activeSession({ server_now: new Date(T0 + 3600 * 1000).toISOString() });
      expect(resumeWindowRemainingMs(s)).toBe(5 * 3600 * 1000);
      expect(resumableSession(s)).toEqual(s);
    } finally {
      spy.mockRestore();
    }
  });

  it('à 6 h pile selon le serveur, la session n’est plus reprenable', () => {
    const s = activeSession({ server_now: new Date(T0 + RESUME_WINDOW_MS).toISOString() });
    expect(resumeWindowRemainingMs(s)).toBe(0);
    expect(resumableSession(s)).toBeNull();
  });

  it('juste avant 6 h, elle l’est encore', () => {
    const s = activeSession({ server_now: new Date(T0 + RESUME_WINDOW_MS - 1000).toISOString() });
    expect(resumableSession(s)).toEqual(s);
  });
});
