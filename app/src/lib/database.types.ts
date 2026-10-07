/**
 * Types de la base, au format de `supabase gen types typescript`.
 *
 * PROVISOIRE (tâche 0.4) : limité à ce que l'auth et l'onboarding utilisent. À remplacer par
 * les types générés de la tâche 0.2 dès qu'ils existent (mêmes noms de tables et de colonnes).
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          pseudo: string | null;
          avatar_id: number | null;
          friend_code: string;
          adult_confirmed_at: string | null;
          reminder_enabled: boolean;
          reminder_time: string;
          lifetime_xp: number;
        };
        // Le profil est créé côté serveur (complete_onboarding), jamais inséré par l'app.
        Insert: {
          id: string;
          pseudo?: string | null;
          avatar_id?: number | null;
          friend_code?: string;
          adult_confirmed_at?: string | null;
          reminder_enabled?: boolean;
          reminder_time?: string;
          lifetime_xp?: number;
        };
        // Le client ne peut écrire que pseudo, avatar et rappel (plan technique §2).
        Update: {
          pseudo?: string;
          avatar_id?: number;
          reminder_enabled?: boolean;
          reminder_time?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      complete_onboarding: {
        Args: { p_pseudo: string; p_avatar_id: number };
        Returns: undefined;
      };
      is_pseudo_available: {
        Args: { p_pseudo: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
