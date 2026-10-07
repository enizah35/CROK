import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { base64ToBytes, bytesToHex } from './bytes';

/** Largeur maximale envoyée : assez pour le fil, légère sur le réseau. */
export const PHOTO_MAX_WIDTH = 1440;
export const PHOTO_JPEG_QUALITY = 0.7;

export type PreparedPhoto = {
  /** JPEG final, exactement les octets envoyés au stockage. */
  bytes: Uint8Array<ArrayBuffer>;
  /** SHA-256 hexadécimal de ces octets (R-12). */
  sha256: string;
};

/** Erreur de préparation locale (fichier illisible) : il faut reprendre la photo. */
export class PhotoPreparationError extends Error {
  constructor(cause: unknown) {
    super('Préparation de la photo impossible', { cause });
    this.name = 'PhotoPreparationError';
  }
}

/**
 * Redimensionne (sans agrandir) et compresse en JPEG, puis calcule l'empreinte SHA-256 des
 * octets finaux : c'est elle que le serveur compare pour refuser une photo déjà utilisée (R-12).
 */
export async function preparePhoto(uri: string, width: number): Promise<PreparedPhoto> {
  try {
    const context = ImageManipulator.manipulate(uri);
    if (width > PHOTO_MAX_WIDTH) context.resize({ width: PHOTO_MAX_WIDTH });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: PHOTO_JPEG_QUALITY,
      base64: true,
    });
    if (!saved.base64) throw new Error('JPEG sans base64');
    const bytes = base64ToBytes(saved.base64);
    if (bytes.length === 0) throw new Error('JPEG vide');
    const hash = await digest(CryptoDigestAlgorithm.SHA256, bytes);
    return { bytes, sha256: bytesToHex(new Uint8Array(hash)) };
  } catch (error) {
    throw new PhotoPreparationError(error);
  }
}
