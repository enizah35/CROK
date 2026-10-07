export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id?: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      challenges: {
        Row: {
          badge_code: string;
          bonus_xp: number;
          created_at: string;
          description: string;
          eligible_recipe_ids: string[];
          id: string;
          title: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          badge_code: string;
          bonus_xp?: number;
          created_at?: string;
          description?: string;
          eligible_recipe_ids?: string[];
          id?: string;
          title: string;
          week_start: string;
        };
        Update: {
          badge_code?: string;
          bonus_xp?: number;
          created_at?: string;
          description?: string;
          eligible_recipe_ids?: string[];
          id?: string;
          title?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      cook_sessions: {
        Row: {
          finished_at: string | null;
          id: string;
          recipe_id: string;
          recipe_version: number;
          servings: number;
          started_at: string;
          status: Database['public']['Enums']['cook_session_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          finished_at?: string | null;
          id?: string;
          recipe_id: string;
          recipe_version: number;
          servings: number;
          started_at?: string;
          status?: Database['public']['Enums']['cook_session_status'];
          user_id?: string;
        };
        Update: {
          finished_at?: string | null;
          id?: string;
          recipe_id?: string;
          recipe_version?: number;
          servings?: number;
          started_at?: string;
          status?: Database['public']['Enums']['cook_session_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cook_sessions_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cook_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      dishes: {
        Row: {
          cook_session_id: string;
          counted: boolean;
          created_at: string;
          day_paris: string;
          hidden: boolean;
          id: string;
          photo_path: string;
          photo_sha256: string;
          recipe_id: string;
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          cook_session_id: string;
          counted: boolean;
          created_at?: string;
          day_paris: string;
          hidden?: boolean;
          id?: string;
          photo_path: string;
          photo_sha256: string;
          recipe_id: string;
          user_id: string;
          week_start: string;
        };
        Update: {
          cook_session_id?: string;
          counted?: boolean;
          created_at?: string;
          day_paris?: string;
          hidden?: boolean;
          id?: string;
          photo_path?: string;
          photo_sha256?: string;
          recipe_id?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dishes_cook_session_id_fkey';
            columns: ['cook_session_id'];
            isOneToOne: true;
            referencedRelation: 'cook_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dishes_recipe_id_fkey';
            columns: ['recipe_id'];
            isOneToOne: false;
            referencedRelation: 'recipes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dishes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          id: number;
          name: string;
          props: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          name: string;
          props?: NonNullable<Json>;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          name?: string;
          props?: NonNullable<Json>;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          created_at: string;
          user_a: string;
          user_b: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_user_a_fkey';
            columns: ['user_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_b_fkey';
            columns: ['user_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          adult_confirmed_at: string | null;
          avatar_id: number | null;
          created_at: string;
          friend_code: string;
          id: string;
          lifetime_xp: number;
          pseudo: string | null;
          reminder_enabled: boolean;
          reminder_time: string;
        };
        ComputedFields: never;
        Insert: {
          adult_confirmed_at?: string | null;
          avatar_id?: number | null;
          created_at?: string;
          friend_code: string;
          id: string;
          lifetime_xp?: number;
          pseudo?: string | null;
          reminder_enabled?: boolean;
          reminder_time?: string;
        };
        Update: {
          adult_confirmed_at?: string | null;
          avatar_id?: number | null;
          created_at?: string;
          friend_code?: string;
          id?: string;
          lifetime_xp?: number;
          pseudo?: string | null;
          reminder_enabled?: boolean;
          reminder_time?: string;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          created_at: string;
          dish_id: string;
          emoji: Database['public']['Enums']['reaction_emoji'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dish_id: string;
          emoji: Database['public']['Enums']['reaction_emoji'];
          user_id?: string;
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          emoji?: Database['public']['Enums']['reaction_emoji'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      recipes: {
        Row: {
          active_min: number;
          cost_cents_per_serving: number;
          cover_path: string | null;
          created_at: string;
          equipment: string[];
          id: string;
          ingredients: NonNullable<Json>;
          published: boolean;
          servings_base: number;
          slug: string;
          steps: NonNullable<Json>;
          tags: string[];
          title: string;
          total_min: number;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          active_min: number;
          cost_cents_per_serving: number;
          cover_path?: string | null;
          created_at?: string;
          equipment?: string[];
          id?: string;
          ingredients?: NonNullable<Json>;
          published?: boolean;
          servings_base: number;
          slug: string;
          steps?: NonNullable<Json>;
          tags?: string[];
          title: string;
          total_min: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active_min?: number;
          cost_cents_per_serving?: number;
          cover_path?: string | null;
          created_at?: string;
          equipment?: string[];
          id?: string;
          ingredients?: NonNullable<Json>;
          published?: boolean;
          servings_base?: number;
          slug?: string;
          steps?: NonNullable<Json>;
          tags?: string[];
          title?: string;
          total_min?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          dish_id: string;
          id: string;
          reason: string;
          reporter_id: string;
          status: Database['public']['Enums']['report_status'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dish_id: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          status?: Database['public']['Enums']['report_status'];
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          status?: Database['public']['Enums']['report_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_badges: {
        Row: {
          badge_code: string;
          challenge_id: string;
          earned_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          badge_code: string;
          challenge_id: string;
          earned_at?: string;
          user_id: string;
        };
        Update: {
          badge_code?: string;
          challenge_id?: string;
          earned_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_badges_challenge_id_fkey';
            columns: ['challenge_id'];
            isOneToOne: false;
            referencedRelation: 'challenges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_weeks: {
        Row: {
          dishes_count: number;
          goal_reached_at: string | null;
          user_id: string;
          week_start: string;
          xp: number;
        };
        ComputedFields: never;
        Insert: {
          dishes_count?: number;
          goal_reached_at?: string | null;
          user_id: string;
          week_start: string;
          xp?: number;
        };
        Update: {
          dishes_count?: number;
          goal_reached_at?: string | null;
          user_id?: string;
          week_start?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'user_weeks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      xp_ledger: {
        Row: {
          amount: number;
          challenge_id: string | null;
          created_at: string;
          dish_id: string | null;
          id: number;
          reason: Database['public']['Enums']['xp_reason'];
          user_id: string;
          week_start: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          challenge_id?: string | null;
          created_at?: string;
          dish_id?: string | null;
          id?: never;
          reason: Database['public']['Enums']['xp_reason'];
          user_id: string;
          week_start: string;
        };
        Update: {
          amount?: number;
          challenge_id?: string | null;
          created_at?: string;
          dish_id?: string | null;
          id?: never;
          reason?: Database['public']['Enums']['xp_reason'];
          user_id?: string;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'xp_ledger_challenge_id_fkey';
            columns: ['challenge_id'];
            isOneToOne: false;
            referencedRelation: 'challenges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'xp_ledger_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'xp_ledger_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean };
      day_paris: { Args: { instant: string }; Returns: string };
      generate_friend_code: { Args: Record<PropertyKey, never>; Returns: string };
      week_start: { Args: { instant: string }; Returns: string };
    };
    Enums: {
      cook_session_status: 'en_cours' | 'terminee' | 'terminee_sans_photo' | 'abandonnee';
      reaction_emoji: 'yum' | 'fire' | 'heart' | 'clap' | 'laugh';
      report_status: 'open' | 'actioned' | 'dismissed';
      xp_reason: 'dish' | 'challenge';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      cook_session_status: ['en_cours', 'terminee', 'terminee_sans_photo', 'abandonnee'],
      reaction_emoji: ['yum', 'fire', 'heart', 'clap', 'laugh'],
      report_status: ['open', 'actioned', 'dismissed'],
      xp_reason: ['dish', 'challenge'],
    },
  },
} as const;
