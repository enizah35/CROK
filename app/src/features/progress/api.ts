import { parseMyProgress, type MyProgress, type Tables } from '@crok/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Clés de cache de la progression. Après la validation d'un plat, invalider `progressKeys.all`
 * rafraîchit à la fois la progression et l'historique des plats.
 */
export const progressKeys = {
  all: ['progress'] as const,
  myDishes: (userId: string) => [...progressKeys.all, 'dishes', userId] as const,
};

/** Nombre de plats affichés dans l'historique du profil. */
export const MY_DISHES_LIMIT = 20;

/** Rafraîchit une requête quand l'app revient au premier plan (heure, jour, semaine changent). */
export function useRefetchOnForeground(refetch: () => unknown, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch, enabled]);
}

/**
 * Progression de l'utilisateur connecté, telle que calculée par `get_my_progress()` (R-16 à
 * R-18). Réponse validée par Zod : une forme inattendue passe la requête en erreur. L'app
 * n'en recalcule aucune valeur (R-08, R-15).
 */
export function useMyProgress() {
  const query = useQuery({
    queryKey: progressKeys.all,
    queryFn: async (): Promise<MyProgress> => {
      const { data, error } = await supabase.rpc('get_my_progress');
      if (error) throw error;
      return parseMyProgress(data);
    },
  });
  useRefetchOnForeground(query.refetch);
  return query;
}

export type MyDish = Pick<Tables<'dishes'>, 'id' | 'created_at' | 'day_paris' | 'counted'> & {
  recipe: { title: string } | null;
};

/** Mes derniers plats, du plus récent au plus ancien (la RLS laisse aussi voir ceux des amis). */
export function useMyDishes(userId: string | null) {
  const query = useQuery({
    queryKey: progressKeys.myDishes(userId ?? 'anonymous'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyDish[]> => {
      const { data, error } = await supabase
        .from('dishes')
        .select('id, created_at, day_paris, counted, recipe:recipes(title)')
        .eq('user_id', userId ?? '')
        .order('created_at', { ascending: false })
        .limit(MY_DISHES_LIMIT);
      if (error) throw error;
      return data;
    },
  });
  useRefetchOnForeground(query.refetch, userId !== null);
  return query;
}
