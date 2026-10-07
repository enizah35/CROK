import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { createChunkedStorage } from './chunkedStorage';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Faux si app/.env.local n'est pas rempli : l'app affiche alors un écran d'erreur clair. */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

// Sur téléphone : session dans le trousseau (voir chunkedStorage.ts). Sur le web (aperçu de
// dev uniquement) : stockage par défaut de supabase-js, localStorage.
const storage = Platform.OS === 'web' ? undefined : createChunkedStorage(SecureStore);

// Valeurs de repli pour que le module se charge (export web, tests) sans configuration ;
// aucun appel réseau n'est fait tant que isSupabaseConfigured est faux.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : 'http://localhost:54321',
  isSupabaseConfigured ? anonKey : 'not-configured',
  {
    auth: {
      ...(storage ? { storage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Recommandation Supabase pour React Native : rafraîchir le jeton seulement au premier plan.
// Enregistré une seule fois, au chargement du module.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
