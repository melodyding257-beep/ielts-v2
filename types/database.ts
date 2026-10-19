// Supabase 数据库类型定义
// Contract for supabase/schema.sql; verify the live schema before deployment.

export interface Database {
  public: {
    Tables: {
      // PDF 文件表
      pdfs: {
        Row: {
          id: string
          user_id: string
          file_name: string
          file_path: string
          parsed_content: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          file_path: string
          parsed_content?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          file_path?: string
          parsed_content?: string | null
          created_at?: string
        }
        Relationships: []
      }
      // 做题记录表
      practice_records: {
        Row: {
          id: string
          user_id: string
          pdf_id: string
          answers: Record<string, string | string[]>
          score: number | null
          correct_count: number | null
          total_count: number | null
          attempt_count: number
          time_spent: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pdf_id: string
          answers: Record<string, string | string[]>
          score?: number | null
          correct_count?: number | null
          total_count?: number | null
          attempt_count?: number
          time_spent: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          pdf_id?: string
          answers?: Record<string, string | string[]>
          score?: number | null
          correct_count?: number | null
          total_count?: number | null
          attempt_count?: number
          time_spent?: number
          created_at?: string
        }
        Relationships: [{
          foreignKeyName: 'practice_records_pdf_id_fkey'
          columns: ['pdf_id']
          isOneToOne: false
          referencedRelation: 'pdfs'
          referencedColumns: ['id']
        }]
      }
      parse_runs: {
        Row: {
          id: string
          user_id: string
          pdf_id: string | null
          run_id: string
          file_hash: string
          file_name: string
          model: string
          parser_version: string
          prompt_version: string
          status: 'passed' | 'warning' | 'failed'
          answer_status: 'complete' | 'none' | 'incomplete' | 'uncertain'
          page_count: number
          question_count: number
          retry_count: number
          timings: Record<string, number>
          validation_report: Record<string, unknown>
          raw_output: Record<string, unknown>
          normalized_output: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pdf_id?: string | null
          run_id: string
          file_hash: string
          file_name: string
          model: string
          parser_version: string
          prompt_version: string
          status: 'passed' | 'warning' | 'failed'
          answer_status: 'complete' | 'none' | 'incomplete' | 'uncertain'
          page_count?: number
          question_count?: number
          retry_count?: number
          timings?: Record<string, number>
          validation_report?: Record<string, unknown>
          raw_output?: Record<string, unknown>
          normalized_output?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          pdf_id?: string | null
          status?: 'passed' | 'warning' | 'failed'
          answer_status?: 'complete' | 'none' | 'incomplete' | 'uncertain'
          timings?: Record<string, number>
          validation_report?: Record<string, unknown>
          raw_output?: Record<string, unknown>
          normalized_output?: Record<string, unknown>
        }
        Relationships: [{
          foreignKeyName: 'parse_runs_pdf_id_fkey'
          columns: ['pdf_id']
          isOneToOne: false
          referencedRelation: 'pdfs'
          referencedColumns: ['id']
        }]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
