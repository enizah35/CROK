import { pseudoKey } from '@crok/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** Valeur qui ne suit `value` qu'après `delayMs` sans changement. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Disponibilité d'un pseudo déjà valide (R-32), via la fonction SQL is_pseudo_available :
 * la RLS de profiles ne laisse pas l'app lire les pseudos des autres.
 * Indicatif seulement : c'est complete_onboarding qui tranche.
 */
export function usePseudoAvailability(pseudo: string | null) {
  return useQuery({
    queryKey: ['pseudo-available', pseudo === null ? null : pseudoKey(pseudo)],
    enabled: pseudo !== null,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_pseudo_available', {
        p_pseudo: pseudo ?? '',
      });
      if (error) throw error;
      return data;
    },
  });
}

/** R-32 : enregistre pseudo, avatar et la confirmation 18+ (horodatée par le serveur). */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pseudo, avatarId }: { pseudo: string; avatarId: number }) => {
      const { error } = await supabase.rpc('complete_onboarding', {
        p_pseudo: pseudo,
        p_avatar_id: avatarId,
      });
      if (error) throw error;
    },
    // Le profil rechargé fait basculer la garde de navigation vers l'app.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
  });
}
