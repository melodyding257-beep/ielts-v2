-- Apply this migration in the Supabase SQL editor before using the parse comparison page.

ALTER TABLE practice_records
  ADD COLUMN IF NOT EXISTS correct_count INTEGER,
  ADD COLUMN IF NOT EXISTS total_count INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_records_user_pdf_unique
  ON practice_records(user_id, pdf_id);

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

CREATE INDEX IF NOT EXISTS idx_parse_runs_user_id ON parse_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_parse_runs_file_hash ON parse_runs(file_hash);
CREATE INDEX IF NOT EXISTS idx_parse_runs_created_at ON parse_runs(created_at DESC);

ALTER TABLE parse_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own parse runs" ON parse_runs;
CREATE POLICY "Users can view their own parse runs"
  ON parse_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own parse runs" ON parse_runs;
CREATE POLICY "Users can insert their own parse runs"
  ON parse_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own parse runs" ON parse_runs;
CREATE POLICY "Users can update their own parse runs"
  ON parse_runs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own practice records" ON practice_records;
CREATE POLICY "Users can update their own practice records"
  ON practice_records FOR UPDATE
  USING (auth.uid() = user_id);
