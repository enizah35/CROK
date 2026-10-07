import { createChunkedStorage, safeKey, type KeyValueBackend } from './chunkedStorage';

function memoryBackend(): KeyValueBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (value.length > 2048) throw new Error('trop long pour SecureStore');
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      data.delete(key);
    },
  };
}

describe('createChunkedStorage', () => {
  const key = 'sb-127-auth-token';

  it('relit une valeur plus longue que la limite de SecureStore', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend);
    const session = JSON.stringify({ access_token: 'a'.repeat(3000), refresh_token: 'r' });
    await storage.setItem(key, session);
    expect(await storage.getItem(key)).toBe(session);
    expect(backend.data.get(`${key}.count`)).toBe('2');
  });

  it('renvoie null sans valeur', async () => {
    expect(await createChunkedStorage(memoryBackend()).getItem(key)).toBeNull();
  });

  it('efface les morceaux en trop quand la valeur rétrécit', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend, 10);
    await storage.setItem(key, 'x'.repeat(35));
    await storage.setItem(key, 'court');
    expect(await storage.getItem(key)).toBe('court');
    expect([...backend.data.keys()].sort()).toEqual([`${key}.0`, `${key}.count`]);
  });

  it('removeItem efface tout', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend, 10);
    await storage.setItem(key, 'y'.repeat(25));
    await storage.removeItem(key);
    expect(backend.data.size).toBe(0);
    expect(await storage.getItem(key)).toBeNull();
  });

  it('renvoie null si un morceau manque (écriture interrompue)', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend, 10);
    await storage.setItem(key, 'z'.repeat(25));
    backend.data.delete(`${key}.1`);
    expect(await storage.getItem(key)).toBeNull();
  });

  it('accepte une valeur vide', async () => {
    const storage = createChunkedStorage(memoryBackend());
    await storage.setItem(key, '');
    expect(await storage.getItem(key)).toBe('');
  });

  it('rend les clés compatibles avec SecureStore', () => {
    expect(safeKey('sb-abc:auth/token')).toBe('sb-abc_auth_token');
  });
});
