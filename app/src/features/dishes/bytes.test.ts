import { base64ToBytes, bytesToHex } from './bytes';

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

describe('base64ToBytes', () => {
  // Vecteurs de la RFC 4648, §10.
  it.each([
    ['', ''],
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYg==', 'foob'],
    ['Zm9vYmE=', 'fooba'],
    ['Zm9vYmFy', 'foobar'],
  ])('%j → %j', (base64, text) => {
    expect(Array.from(base64ToBytes(base64))).toEqual(ascii(text));
  });

  it('décode les octets hauts et ignore les retours à la ligne', () => {
    expect(Array.from(base64ToBytes('/9j/\n4AA='))).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00]);
  });
});

describe('bytesToHex', () => {
  it('écrit deux chiffres minuscules par octet', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
  });
});
