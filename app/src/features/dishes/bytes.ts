const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...ALPHABET].map((char, index) => [char, index]));

/**
 * Décode du base64 (sortie d'expo-image-manipulator) en octets, sans dépendre d'`atob`.
 * Les caractères hors alphabet (retours à la ligne, `=`) sont ignorés.
 */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = [...base64].filter((char) => LOOKUP.has(char));
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | (LOOKUP.get(char) ?? 0);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

/** Octets → hexadécimal en minuscules (format attendu par le serveur pour l'empreinte). */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
