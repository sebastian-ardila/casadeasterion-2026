export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          added_at: string
          added_by: string | null
          email: string
          note: string | null
          role: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          email: string
          note?: string | null
          role?: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          email?: string
          note?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_emails_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_permissions: {
        Row: {
          level: string
          profile_id: string
          resource: string
          updated_at: string
        }
        Insert: {
          level?: string
          profile_id: string
          resource: string
          updated_at?: string
        }
        Update: {
          level?: string
          profile_id?: string
          resource?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          bio_md: string | null
          created_at: string
          id: string
          keywords: string[] | null
          links: Json
          name: string
          photo_url: string | null
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bio_md?: string | null
          created_at?: string
          id?: string
          keywords?: string[] | null
          links?: Json
          name: string
          photo_url?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bio_md?: string | null
          created_at?: string
          id?: string
          keywords?: string[] | null
          links?: Json
          name?: string
          photo_url?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_authors: {
        Row: {
          author_id: string
          book_id: string
          created_at: string
          sort_order: number
        }
        Insert: {
          author_id: string
          book_id: string
          created_at?: string
          sort_order?: number
        }
        Update: {
          author_id?: string
          book_id?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author_id: string | null
          canonical_url: string | null
          category_id: string | null
          cover_image_alt: string | null
          cover_image_url: string | null
          created_at: string
          description_md: string | null
          format: string | null
          gallery_urls: string[]
          id: string
          isbn: string | null
          keywords: string[] | null
          pages: number | null
          price_amount: number | null
          price_currency: string
          publication_date: string | null
          published_at: string | null
          slug: string
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
          whatsapp_message_override: string | null
        }
        Insert: {
          author_id?: string | null
          canonical_url?: string | null
          category_id?: string | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          description_md?: string | null
          format?: string | null
          gallery_urls?: string[]
          id?: string
          isbn?: string | null
          keywords?: string[] | null
          pages?: number | null
          price_amount?: number | null
          price_currency?: string
          publication_date?: string | null
          published_at?: string | null
          slug: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_message_override?: string | null
        }
        Update: {
          author_id?: string | null
          canonical_url?: string | null
          category_id?: string | null
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          description_md?: string | null
          format?: string | null
          gallery_urls?: string[]
          id?: string
          isbn?: string | null
          keywords?: string[] | null
          pages?: number | null
          price_amount?: number | null
          price_currency?: string
          publication_date?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_message_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          kind: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          kind: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          bio_md: string | null
          created_at: string
          id: string
          keywords: string[] | null
          links: Json
          name: string
          photo_url: string | null
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bio_md?: string | null
          created_at?: string
          id?: string
          keywords?: string[] | null
          links?: Json
          name: string
          photo_url?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bio_md?: string | null
          created_at?: string
          id?: string
          keywords?: string[] | null
          links?: Json
          name?: string
          photo_url?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_rebuild: {
        Row: {
          id: number
          last_dispatched_at: string | null
          requested_at: string
        }
        Insert: {
          id: number
          last_dispatched_at?: string | null
          requested_at?: string
        }
        Update: {
          id?: number
          last_dispatched_at?: string | null
          requested_at?: string
        }
        Relationships: []
      }
      post_authors: {
        Row: {
          author_id: string
          created_at: string
          post_id: string
          sort_order: number
        }
        Insert: {
          author_id: string
          created_at?: string
          post_id: string
          sort_order?: number
        }
        Update: {
          author_id?: string
          created_at?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_authors_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_collaborators: {
        Row: {
          collaborator_id: string
          created_at: string
          post_id: string
          sort_order: number
        }
        Insert: {
          collaborator_id: string
          created_at?: string
          post_id: string
          sort_order?: number
        }
        Update: {
          collaborator_id?: string
          created_at?: string
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_collaborators_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_collaborators_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          book_id: string | null
          canonical_url: string | null
          category_id: string | null
          content_md: string
          cover_image_alt: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          gallery_urls: string[]
          id: string
          keywords: string[] | null
          meta_description: string | null
          published_at: string | null
          reading_time_minutes: number | null
          slug: string
          status: string
          subtitle: string | null
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          author_id?: string | null
          book_id?: string | null
          canonical_url?: string | null
          category_id?: string | null
          content_md: string
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          gallery_urls?: string[]
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          slug: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          author_id?: string | null
          book_id?: string | null
          canonical_url?: string | null
          category_id?: string | null
          content_md?: string
          cover_image_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          gallery_urls?: string[]
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          slug?: string
          status?: string
          subtitle?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_active_at: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_active_at?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_intent_items: {
        Row: {
          book_id: string | null
          book_isbn: string | null
          book_slug: string
          book_title: string
          cover_image_url: string | null
          created_at: string
          currency: string
          id: string
          intent_id: string
          position: number
          quantity: number
          unit_price: number | null
        }
        Insert: {
          book_id?: string | null
          book_isbn?: string | null
          book_slug: string
          book_title: string
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          intent_id: string
          position?: number
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          book_id?: string | null
          book_isbn?: string | null
          book_slug?: string
          book_title?: string
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          intent_id?: string
          position?: number
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_intent_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_intent_items_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_intents: {
        Row: {
          created_at: string
          currency: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          status: string
          total_amount: number
          updated_at: string
          updated_by: string | null
          whatsapp_message: string
        }
        Insert: {
          created_at?: string
          currency?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_message: string
        }
        Update: {
          created_at?: string
          currency?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          whatsapp_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_intents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_intents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      site_configuration: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_configuration_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          bio_md: string | null
          created_at: string
          email: string | null
          id: string
          links: Json
          name: string
          photo_url: string | null
          role: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bio_md?: string | null
          created_at?: string
          email?: string | null
          id?: string
          links?: Json
          name: string
          photo_url?: string | null
          role: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bio_md?: string | null
          created_at?: string
          email?: string | null
          id?: string
          links?: Json
          name?: string
          photo_url?: string | null
          role?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          source: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          source?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          source?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      delete_admin_user: { Args: { target_id: string }; Returns: undefined }
      dispatch_rebuild_if_due: { Args: never; Returns: undefined }
      get_secret: { Args: { p_name: string }; Returns: string }
      has_permission: {
        Args: { lvl: string; res: string; uid: string }
        Returns: boolean
      }
      is_admin: { Args: { uid: string }; Returns: boolean }
      is_owner: { Args: { uid: string }; Returns: boolean }
      list_cms_users: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
          last_active_at: string
          last_sign_in_at: string
          role: string
        }[]
      }
      queue_rebuild: { Args: never; Returns: undefined }
      touch_profile_activity: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
