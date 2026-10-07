import { PHOTO_MAX_WIDTH, PhotoPreparationError, preparePhoto } from './preparePhoto';

const mockResize = jest.fn();
const mockSave = jest.fn();
const mockDigest = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      const context = {
        resize: (size: unknown) => {
          mockResize(size);
          return context;
        },
        renderAsync: async () => ({ saveAsync: (options: unknown) => mockSave(options) }),
      };
      return context;
    },
  },
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: (...args: unknown[]) => mockDigest(...args),
}));

beforeEach(() => {
  mockResize.mockReset();
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///out.jpg', base64: '/9j/4AA=' });
  mockDigest.mockReset().mockResolvedValue(new Uint8Array(32).fill(0xab).buffer);
});

describe('preparePhoto', () => {
  it('réduit à 1440 px, compresse en JPEG et hache les octets finaux (R-12)', async () => {
    const photo = await preparePhoto('file:///photo.jpg', 4032);
    expect(mockResize).toHaveBeenCalledWith({ width: PHOTO_MAX_WIDTH });
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.7, base64: true });
    expect(Array.from(photo.bytes)).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    // L'empreinte porte sur les octets envoyés, pas sur le fichier de l'appareil photo.
    expect(mockDigest).toHaveBeenCalledWith('SHA-256', photo.bytes);
    expect(photo.sha256).toBe('ab'.repeat(32));
  });

  it('n’agrandit pas une photo déjà petite', async () => {
    await preparePhoto('file:///photo.jpg', 1080);
    expect(mockResize).not.toHaveBeenCalled();
  });

  it('erreur de préparation si l’image est illisible', async () => {
    mockSave.mockResolvedValue({ uri: 'file:///out.jpg' });
    await expect(preparePhoto('file:///photo.jpg', 4032)).rejects.toBeInstanceOf(
      PhotoPreparationError,
    );
  });
});
