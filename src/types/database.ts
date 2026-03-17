// Generated types will go here after running `npm run db:generate`
// For now, define the basic structure

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      coaches: {
        Row: {
          id: string
          email: string
          name: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
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
      }
      content: {
        Row: {
          id: string
          coach_id: string
          type: string
          status: string
          body: string
          framework_id: string | null
          batch_id: string | null
          batch_position: number | null
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
          batch_id?: string | null
          batch_position?: number | null
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
          batch_id?: string | null
          batch_position?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          coach_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          coach_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
