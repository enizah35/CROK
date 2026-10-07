/**
 * Accès serveur du mode cuisine (R-03 à R-06). Le client lance une session par INSERT direct,
 * change les portions ou abandonne par UPDATE (RLS de la phase 0) ; la session active et son
 * âge viennent de `get_active_cook_session()`.
 */
import type { TablesInsert } from '@crok/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearLocalCookState } from './cleanup';
import {
  cookRecipeSchema,
  parseActiveSession,
  type ActiveSession,
  type CookRecipe,
} from './session';
import { supabase } from '@/lib/supabase';

export const cookKeys = {
  active: ['cook', 'active'] as const,
  recipe: (recipeId: string) => ['cook', 'recipe', recipeId] as const,
};

// TODO(1.3) : get_active_cook_session n'est pas encore dans database.types.ts (régénéré par
// l'agent 1.3). Appel non typé en attendant ; la réponse est de toute façon validée par Zod.
type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

export async function fetchActiveSession(): Promise<ActiveSession | null> {
  const rpc = supabase.rpc as unknown as UntypedRpc;
  const { data, error } = await rpc.call(supabase, 'get_active_cook_session');
  if (error) throw error;
  return parseActiveSession(data);
}

/** R-03 : le trigger pose started_at, le statut et la version, et abandonne la session précédente. */
export async function startCookSession(recipeId: string, servings: number): Promise<string> {
  // Seules ces colonnes sont accordées au client ; recipe_version est posé par le trigger
  // (le type généré l'exige pourtant, d'où la conversion).
  const row = { recipe_id: recipeId, servings } as TablesInsert<'cook_sessions'>;
  const { data, error } = await supabase.from('cook_sessions').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function fetchCookRecipe(recipeId: string): Promise<CookRecipe> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, version, title, servings_base, ingredients, steps')
    .eq('id', recipeId)
    .single();
  if (error) throw error;
  return cookRecipeSchema.parse(data);
}

export async function updateSessionServings(sessionId: string, servings: number): Promise<void> {
  const { error } = await supabase.from('cook_sessions').update({ servings }).eq('id', sessionId);
  if (error) throw error;
}

export async function abandonSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('cook_sessions')
    .update({ status: 'abandonnee' })
    .eq('id', sessionId);
  if (error) throw error;
}

/** Session en cours selon le serveur (R-06), toujours relue fraîchement. */
export function useActiveCookSession() {
  return useQuery({
    queryKey: cookKeys.active,
    queryFn: fetchActiveSession,
    staleTime: 0,
  });
}

export function useCookRecipe(recipeId: string | null) {
  return useQuery({
    queryKey: cookKeys.recipe(recipeId ?? ''),
    enabled: recipeId !== null,
    queryFn: () => fetchCookRecipe(recipeId ?? ''),
  });
}

export function useStartCookSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, servings }: { recipeId: string; servings: number }) => {
      const id = await startCookSession(recipeId, servings);
      // La session précédente vient d'être abandonnée par le serveur : on oublie son état local.
      await clearLocalCookState(id);
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cookKeys.active }),
  });
}

export function useUpdateServings(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (servings: number) => updateSessionServings(sessionId, servings),
    onMutate: (servings) => {
      // Affichage immédiat des nouvelles quantités ; rétabli en cas d'échec.
      const previous = queryClient.getQueryData<ActiveSession | null>(cookKeys.active);
      if (previous && previous.id === sessionId) {
        queryClient.setQueryData<ActiveSession>(cookKeys.active, { ...previous, servings });
      }
      return { previous };
    },
    onError: (_error, _servings, context) => {
      if (context) queryClient.setQueryData(cookKeys.active, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cookKeys.active }),
  });
}

/** L'écran appelant navigue ailleurs en cas de succès ; la session active sera relue au besoin. */
export function useAbandonSession(sessionId: string) {
  return useMutation({
    mutationFn: async () => {
      await abandonSession(sessionId);
      await clearLocalCookState(null);
    },
  });
}
