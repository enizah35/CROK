import { describe, expect, it } from 'vitest';

import {
  AVATAR_IDS,
  isCompleteOtp,
  isPlausibleEmail,
  isValidAvatarId,
  normalizeEmail,
  pseudoErrorMessage,
  pseudoKey,
  sanitizeOtpInput,
  validatePseudo,
} from './account';

// R-32 : mêmes cas que le test SQL de complete_onboarding (supabase/tests).
describe('validatePseudo (R-32)', () => {
  it.each([
    ['abc', 'abc'],
    ['Lea_2006', 'Lea_2006'],
    ['a'.repeat(20), 'a'.repeat(20)],
    ['  Malik  ', 'Malik'],
    ['123', '123'],
  ])('accepte %j', (raw, expected) => {
    expect(validatePseudo(raw)).toEqual({ ok: true, pseudo: expected });
  });

  it.each([
    ['', 'too_short'],
    ['ab', 'too_short'],
    ['  ab  ', 'too_short'],
    ['a'.repeat(21), 'too_long'],
    ['léa', 'invalid_chars'],
    ['lea marie', 'invalid_chars'],
    ['lea-marie', 'invalid_chars'],
    ['lea.marie', 'invalid_chars'],
    ['inès!', 'invalid_chars'],
    ['😀😀😀', 'invalid_chars'],
  ])('refuse %j (%s)', (raw, error) => {
    expect(validatePseudo(raw)).toEqual({ ok: false, error });
  });

  it('donne un message en français pour chaque erreur', () => {
    expect(pseudoErrorMessage('too_short')).toContain('au moins 3');
    expect(pseudoErrorMessage('too_long')).toContain('au plus 20');
    expect(pseudoErrorMessage('invalid_chars')).toContain('lettres');
  });

  it("ignore la casse et les espaces pour l'unicité", () => {
    expect(pseudoKey(' Lea ')).toBe(pseudoKey('lea'));
    expect(pseudoKey('LEA')).toBe('lea');
  });
});

describe('avatars (R-32)', () => {
  it('propose 12 avatars numérotés de 1 à 12', () => {
    expect(AVATAR_IDS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it.each([
    [1, true],
    [12, true],
    [0, false],
    [13, false],
    [1.5, false],
    [Number.NaN, false],
  ])('isValidAvatarId(%s) = %s', (value, expected) => {
    expect(isValidAvatarId(value)).toBe(expected);
  });
});

describe('code reçu par email (R-32)', () => {
  it('ne garde que 6 chiffres', () => {
    expect(sanitizeOtpInput('12a34')).toBe('1234');
    expect(sanitizeOtpInput('123 456')).toBe('123456');
    expect(sanitizeOtpInput('12345678')).toBe('123456');
    expect(sanitizeOtpInput('')).toBe('');
  });

  it('reconnaît un code complet', () => {
    expect(isCompleteOtp('123456')).toBe(true);
    expect(isCompleteOtp('12345')).toBe(false);
    expect(isCompleteOtp('1234567')).toBe(false);
    expect(isCompleteOtp('12345a')).toBe(false);
  });
});

describe('email', () => {
  it('normalise la saisie', () => {
    expect(normalizeEmail('  Lea@Exemple.FR ')).toBe('lea@exemple.fr');
  });

  it.each([
    ['lea@exemple.fr', true],
    [' lea@exemple.fr ', true],
    ['lea@exemple', false],
    ['lea exemple.fr', false],
    ['', false],
  ])('isPlausibleEmail(%j) = %s', (raw, expected) => {
    expect(isPlausibleEmail(raw)).toBe(expected);
  });
});
