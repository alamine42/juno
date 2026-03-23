// Database types for Supabase
// Re-run `npm run db:generate` after schema changes to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Relationship type for Supabase generic schema compatibility
type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      coaches: {
        Row: {
          id: string
          email: string
          name: string | null
          timezone: string
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          timezone?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          timezone?: string
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: GenericRelationship[]
      }
      brand_profiles: {
        Row: {
          id: string
          coach_id: string
          style_words: string | null
          tone: string | null
          emoji_usage: string | null
          sign_off: string | null
          avoided_topics: string[] | null
          avoided_words: string[] | null
          preferred_words: string[] | null
          target_audience: string | null
          example_posts: string[] | null
          completed_at: string | null
          skipped_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          style_words?: string | null
          tone?: string | null
          emoji_usage?: string | null
          sign_off?: string | null
          avoided_topics?: string[] | null
          avoided_words?: string[] | null
          preferred_words?: string[] | null
          target_audience?: string | null
          example_posts?: string[] | null
          completed_at?: string | null
          skipped_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          style_words?: string | null
          tone?: string | null
          emoji_usage?: string | null
          sign_off?: string | null
          avoided_topics?: string[] | null
          avoided_words?: string[] | null
          preferred_words?: string[] | null
          target_audience?: string | null
          example_posts?: string[] | null
          completed_at?: string | null
          skipped_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: GenericRelationship[]
      }
      content_frameworks: {
        Row: {
          id: string
          name: string
          description: string | null
          output_type: string | null
          questions: Json
          prompt_template: string
          display_order: number
          active: boolean
          created_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string | null
          output_type?: string | null
          questions: Json
          prompt_template: string
          display_order?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          output_type?: string | null
          questions?: Json
          prompt_template?: string
          display_order?: number
          active?: boolean
          created_at?: string
        }
        Relationships: GenericRelationship[]
      }
      content_batches: {
        Row: {
          id: string
          coach_id: string
          focus_topic: string | null
          posting_days: string[] | null
          has_promotion: boolean
          promotion_text: string | null
          status: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          focus_topic?: string | null
          posting_days?: string[] | null
          has_promotion?: boolean
          promotion_text?: string | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          focus_topic?: string | null
          posting_days?: string[] | null
          has_promotion?: boolean
          promotion_text?: string | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Relationships: GenericRelationship[]
      }
      content: {
        Row: {
          id: string
          coach_id: string
          type: string
          status: string
          body: string
          framework_id: string | null
          framework_answers: Json | null
          batch_id: string | null
          batch_position: number | null
          reminder_at: string | null
          reminder_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          type: string
          status?: string
          body: string
          framework_id?: string | null
          framework_answers?: Json | null
          batch_id?: string | null
          batch_position?: number | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          type?: string
          status?: string
          body?: string
          framework_id?: string | null
          framework_answers?: Json | null
          batch_id?: string | null
          batch_position?: number | null
          reminder_at?: string | null
          reminder_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: GenericRelationship[]
      }
      chat_messages: {
        Row: {
          id: string
          coach_id: string
          role: 'user' | 'assistant'
          content: string
          content_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          role: 'user' | 'assistant'
          content: string
          content_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          role?: 'user' | 'assistant'
          content?: string
          content_id?: string | null
          created_at?: string
        }
        Relationships: GenericRelationship[]
      }
      framework_usage: {
        Row: {
          id: string
          coach_id: string
          framework_id: string
          content_id: string | null
          answers: Json | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          framework_id: string
          content_id?: string | null
          answers?: Json | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          framework_id?: string
          content_id?: string | null
          answers?: Json | null
          completed?: boolean
          created_at?: string
        }
        Relationships: GenericRelationship[]
      }
      system_health: {
        Row: {
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
        }
        Relationships: GenericRelationship[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Commonly used types
export type Coach = Tables<'coaches'>
export type BrandProfile = Tables<'brand_profiles'>
export type Content = Tables<'content'>
export type ChatMessage = Tables<'chat_messages'>
export type ContentFramework = Tables<'content_frameworks'>
export type ContentBatch = Tables<'content_batches'>
export type FrameworkUsage = Tables<'framework_usage'>
export type SystemHealth = Tables<'system_health'>
