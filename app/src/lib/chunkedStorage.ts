/**
 * Stockage de la session Supabase dans le trousseau du téléphone (Keychain iOS, Keystore
 * Android) via expo-secure-store.
 *
 * Pourquoi pas AsyncStorage (exemple par défaut de la doc Supabase) : AsyncStorage écrit en
 * clair sur le disque, or la session contient le jeton de rafraîchissement, qui donne accès
 * au compte. SecureStore chiffre, mais une valeur peut être refusée au-delà d'environ 2 Ko
 * (avertissement de la doc Expo) alors qu'une session dépasse souvent cette taille : on la
 * découpe donc en morceaux. C'est l'alternative sans dépendance crypto au « LargeSecureStore »
 * de la doc Supabase (clé AES dans SecureStore, données chiffrées dans AsyncStorage).
 */

/** Ce dont l'adaptateur a besoin : le sous-ensemble asynchrone d'expo-secure-store. */
export type KeyValueBackend = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** Interface attendue par supabase-js pour `auth.storage`. */
export type SupportedStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Taille d'un morceau, en caractères : sous la limite d'environ 2 Ko de SecureStore. */
export const CHUNK_SIZE = 1800;

/** SecureStore n'accepte que [A-Za-z0-9._-] dans les clés. */
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

function countKey(key: string): string {
  return `${safeKey(key)}.count`;
}

function chunkKey(key: string, index: number): string {
  return `${safeKey(key)}.${index}`;
}

export function createChunkedStorage(
  backend: KeyValueBackend,
  chunkSize: number = CHUNK_SIZE,
): SupportedStorage {
  async function readCount(key: string): Promise<number> {
    const raw = await backend.getItemAsync(countKey(key));
    const count = raw === null ? 0 : Number(raw);
    return Number.isInteger(count) && count > 0 ? count : 0;
  }

  async function removeChunks(key: string, from: number, to: number): Promise<void> {
    for (let i = from; i < to; i += 1) {
      await backend.deleteItemAsync(chunkKey(key, i));
    }
  }

  return {
    async getItem(key) {
      const count = await readCount(key);
      if (count === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await backend.getItemAsync(chunkKey(key, i));
        // Écriture interrompue : mieux vaut aucune session qu'une session corrompue.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const previous = await readCount(key);
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += chunkSize) {
        parts.push(value.slice(i, i + chunkSize));
      }
      if (parts.length === 0) parts.push('');
      // Le compteur passe à 0 pendant l'écriture : une lecture concurrente voit « pas de
      // session » plutôt qu'un mélange d'ancien et de nouveau.
      await backend.deleteItemAsync(countKey(key));
      for (const [i, part] of parts.entries()) {
        await backend.setItemAsync(chunkKey(key, i), part);
      }
      await backend.setItemAsync(countKey(key), String(parts.length));
      await removeChunks(key, parts.length, previous);
    },

    async removeItem(key) {
      const count = await readCount(key);
      await backend.deleteItemAsync(countKey(key));
      await removeChunks(key, 0, count);
    },
  };
}
