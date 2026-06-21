// Supabase 数据库类型定义
// 根据实际数据库 schema 更新

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
      }
      // 做题记录表
      practice_records: {
        Row: {
          id: string
          user_id: string
          pdf_id: string
          answers: Record<string, string>
          score: number | null
          time_spent: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pdf_id: string
          answers: Record<string, string>
          score?: number | null
          time_spent: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          pdf_id?: string
          answers?: Record<string, string>
          score?: number | null
          time_spent?: number
          created_at?: string
        }
      }
    }
  }
}
