import { useQuery } from '@tanstack/react-query';

import type { OnboardingFields } from './accountStatus';
import { supabase } from '@/lib/supabase';

export const profileKeys = {
  me: (userId: string) => ['profile', 'me', userId] as const,
};

/** Profil de l'utilisateur connecté ; `null` si la ligne n'existe pas encore. */
export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.me(userId ?? 'anonymous'),
    enabled: userId !== null,
    queryFn: async (): Promise<OnboardingFields | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('pseudo, avatar_id, adult_confirmed_at')
        .eq('id', userId ?? '')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
