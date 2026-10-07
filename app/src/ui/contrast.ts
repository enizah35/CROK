/**
 * Calcul du contraste WCAG 2.x entre deux couleurs hexadécimales (#RRGGBB).
 * Utilisé par les tests de la palette et par Avatar pour choisir la couleur du chiffre.
 */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative (0 = noir, 1 = blanc). */
export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) {
    throw new Error(`Couleur invalide : ${hex} (format attendu #RRGGBB)`);
  }
  const n = parseInt(match[1], 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste, entre 1 et 21. AA : 4,5 pour le texte, 3 pour le grand texte et les contours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Parmi plusieurs couleurs de texte, renvoie la plus lisible sur le fond donné. */
export function mostReadable(
  background: string,
  candidates: readonly [string, ...string[]],
): string {
  let best = candidates[0];
  for (const c of candidates) {
    if (contrastRatio(background, c) > contrastRatio(background, best)) best = c;
  }
  return best;
}
