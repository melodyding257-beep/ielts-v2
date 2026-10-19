export interface BackendQuestion {
  id: string
  sectionTitle: string
  direction: string
  type:
    | 'choice_single'
    | 'choice_multi'
    | 'choice_judge'
    | 'matching_paragraph'
    | 'matching_headings'
    | 'matching_list'
    | 'fill_blank'
    | 'fill_blank_summary'
  text: string
  options: string[] | null
  selectCount: number
  sharedOptions: string[] | null
  contentBlocks?: QuestionContentBlock[] | null
}

export interface QuestionContentBlock {
  type: 'title' | 'subheading' | 'bullet' | 'paragraph'
  text: string
}

export interface ParsedData {
  title?: string
  article: string
  articleBlocks?: ArticleBlock[]
  questions: BackendQuestion[]
  answerStatus?: 'complete' | 'none' | 'incomplete' | 'uncertain'
  answerSource?: 'uploaded_document' | 'none'
  analysisStatus?: 'complete' | 'none' | 'incomplete' | 'uncertain'
  analysisSource?: 'uploaded_document' | 'none'
  answers: Record<string, string>
  answerEvidence?: Record<string, { page?: number; text?: string }>
  locations: Record<string, string>
  explanations: Record<string, string>
  parseMeta?: ParseMeta
}

export interface TextRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export interface ParagraphLabel {
  text: string
  bold?: boolean
  italic?: boolean
}

export interface ArticleBlock {
  type: 'subtitle' | 'heading' | 'paragraph' | 'bullet'
  text: string
  label?: ParagraphLabel | null
  runs?: TextRun[]
  alignment?: 'left' | 'center' | 'right' | 'justify'
  sizeRole?: 'subtitle' | 'heading' | 'body' | 'small'
  fontFamilyRole?: 'serif' | 'sans' | 'monospace' | 'unknown'
  page?: number | null
}

export interface ParseTimings {
  preprocessMs?: number
  primaryModelMs?: number
  validationMs?: number
  verificationModelMs?: number
  postprocessMs?: number
  backendTotalMs?: number
  backendRoundTripMs?: number
  nextPipelineMs?: number
  endToEndMs?: number
  storageMs?: number
  databaseMs?: number
  cacheLookupMs?: number
}

export interface ParseValidationReport {
  status: 'passed' | 'warning' | 'failed'
  errors: string[]
  warnings: string[]
  initialErrors?: string[]
  verificationPages?: number[]
  expectedQuestionIds?: string[]
  blankIds?: string[]
  answerIds?: string[]
  nativeLabelCandidates?: string[]
  parsedParagraphLabels?: string[]
  styleMetrics?: {
    nativeBoldSpans: number
    nativeItalicSpans: number
    parsedBoldRuns: number
    parsedItalicRuns: number
  }
}

export interface ParseMeta {
  runId: string
  fileHash: string
  model: string
  parserVersion: string
  promptVersion: string
  retryCount: number
  cacheHit?: boolean
  cachedFromRunId?: string
  initialValidationErrors?: string[]
  verificationPages?: number[]
  timing: ParseTimings
  validation: ParseValidationReport
  rawModelOutput?: { primary?: string; verification?: string | null }
}

export interface PracticeRecord {
  id: string
  pdf_id: string
  answers: Record<string, string | string[]>
  time_spent: number
  correct_count: number | null
  total_count: number | null
  attempt_count: number
}

export interface ParseRun {
  id: string
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
  timings: ParseTimings
  validation_report: ParseValidationReport
  raw_output: Record<string, unknown>
  normalized_output: Partial<ParsedData>
  created_at: string
}

