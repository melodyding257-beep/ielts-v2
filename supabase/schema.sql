-- 创建 pdfs 表（PDF 文件记录）
CREATE TABLE IF NOT EXISTS pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  parsed_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 practice_records 表（做题记录）
CREATE TABLE IF NOT EXISTS practice_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_id UUID NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  score NUMERIC(5, 2),
  time_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pdfs_user_id ON pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_user_id ON practice_records(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_pdf_id ON practice_records(pdf_id);

-- 启用 RLS（Row Level Security）
ALTER TABLE pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_records ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view their own pdfs"
  ON pdfs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pdfs"
  ON pdfs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pdfs"
  ON pdfs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pdfs"
  ON pdfs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own practice records"
  ON practice_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own practice records"
  ON practice_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);
