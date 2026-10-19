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
  correct_count INTEGER,
  total_count INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  time_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pdf_id)
);

-- 每一次解析都单独记录。file_hash 只用于比较同一文件的多次运行，绝不用于缓存命中。
CREATE TABLE IF NOT EXISTS parse_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pdf_id UUID REFERENCES pdfs(id) ON DELETE CASCADE,
  run_id UUID NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  model TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'warning', 'failed')),
  answer_status TEXT NOT NULL CHECK (answer_status IN ('complete', 'none', 'incomplete', 'uncertain')),
  page_count INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  timings JSONB NOT NULL DEFAULT '{}',
  validation_report JSONB NOT NULL DEFAULT '{}',
  raw_output JSONB NOT NULL DEFAULT '{}',
  normalized_output JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_pdfs_user_id ON pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_user_id ON practice_records(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_records_pdf_id ON practice_records(pdf_id);
CREATE INDEX IF NOT EXISTS idx_parse_runs_user_id ON parse_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_parse_runs_file_hash ON parse_runs(file_hash);
CREATE INDEX IF NOT EXISTS idx_parse_runs_created_at ON parse_runs(created_at DESC);

-- 启用 RLS（Row Level Security）
ALTER TABLE pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE parse_runs ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can update their own practice records"
  ON practice_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own parse runs"
  ON parse_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own parse runs"
  ON parse_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parse runs"
  ON parse_runs FOR UPDATE
  USING (auth.uid() = user_id);
