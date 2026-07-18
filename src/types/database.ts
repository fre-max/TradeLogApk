// Type généré manuellement — à remplacer par `supabase gen types typescript`
// une fois les tables créées dans Supabase

export interface Database {
  public: {
    Tables: {
      trades: {
        Row: {
          id: string
          user_id: string
          pair: string
          direction: 'long' | 'short'
          session: string
          date_backtested: string
          entry_time: string | null
          result: 'win' | 'loss' | 'breakeven' | null
          rr_planned: number | null
          rr_realized: number | null
          exit_type: string | null
          emotion: string | null
          status: 'quick' | 'in_progress' | 'complete'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['trades']['Insert']>
      }
      steps: {
        Row: {
          id: string
          trade_id: string
          order: number
          type: string
          title: string
          timeframe: string | null
          notes: string | null
          fields: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['steps']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['steps']['Insert']>
      }
      trade_images: {
        Row: {
          id: string
          trade_id: string
          phase: 'avant' | 'apres'
          context: 'superieur' | 'intermediaire' | 'inferieur' | 'global'
          url: string
          source: 'telegram' | 'upload' | 'url'
          storage_path: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['trade_images']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['trade_images']['Insert']>
      }
      combo_memory: {
        Row: {
          id: string
          field_key: string
          value: string
          used_count: number
          last_used: string
        }
        Insert: Omit<Database['public']['Tables']['combo_memory']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['combo_memory']['Insert']>
      }
      reason_families: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          order: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reason_families']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reason_families']['Insert']>
      }
      reason_catalog: {
        Row: {
          id: string
          user_id: string
          family_id: string
          title: string
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reason_catalog']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reason_catalog']['Insert']>
      }
      reason_variants: {
        Row: {
          id: string
          reason_id: string
          name: string
          image_url: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reason_variants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['reason_variants']['Insert']>
      }
      trade_reasons: {
        Row: {
          trade_id: string
          reason_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['trade_reasons']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['trade_reasons']['Insert']>
      }
    }
  }
}
