export interface BackendQuestion {
  id: string
  sectionTitle: string
  direction: string
  type:
    | 'choice_single'
    | 'choice_multi'
    | 'choice_judge'
    | 'matching_paragraph'
    | 'matching_list'
    | 'fill_blank'
    | 'fill_blank_summary'
  text: string
  options: string[] | null
  selectCount: number
  sharedOptions: string[] | null
}

export interface ParsedData {
  article: string
  questions: BackendQuestion[]
  answers: Record<string, string>
  locations: Record<string, string>
  explanations: Record<string, string>
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

/** "7-8" → ["7","8"],  "37-40" → ["37","38","39","40"],  "27" → ["27"] */
export function getSubIds(q: BackendQuestion): string[] {
  const rangeMatch = q.id.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    return Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
  }
  return [q.id]
}

/** Splits fill_blank_summary text into segments with blank ids.
 *  e.g. "text 37 _______ more 38 _______" →
 *  [{before:"text ", id:"37"}, {before:" more ", id:"38"}, {before:"", id:""}(trailing)]
 */
export function parseSummaryText(
  text: string
): Array<{ before: string; id: string }> {
  const parts: Array<{ before: string; id: string }> = []
  const regex = /(\d+)\s*_{3,}/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    parts.push({ before: text.slice(lastIndex, match.index), id: match[1] })
    lastIndex = match.index + match[0].length
  }
  parts.push({ before: text.slice(lastIndex), id: '' })
  return parts
}

export function normalizeAnswer(s: string): string {
  if (!s) return ''
  return s.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[.。,，;；]/g, '')
}

/** Extract just the leading letter from a matching_list answer.
 *  "A.Rodomiro Ortiz" → "A",  "A" → "A",  "TRUE" → "TRUE"
 */
export function extractLetter(s: string): string {
  if (!s) return ''
  const m = s.trim().toUpperCase().match(/^([A-Z])/)
  return m ? m[1] : normalizeAnswer(s)
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Splits a fill_blank sentence into before/after parts around the blank marker.
 *  Matches: ___ (3+ underscores), — (em-dash), – (en-dash)
 *  e.g. "The gov has ________ the plan" → { before: "The gov has ", after: " the plan" }
 *  If no marker found → { before: text, after: "" }
 */
export function parseFillText(text: string): { before: string; after: string } {
  // match number+blank like "37 _______", standalone blank, or em-dash
  const regex = /(\d+\s*)?_{3,}|—{1,}|–{1,}/
  const match = regex.exec(text)
  if (!match) return { before: text, after: '' }
  return {
    before: text.slice(0, match.index),
    after: text.slice(match.index + match[0].length),
  }
}

export function calculateScore(
  questions: BackendQuestion[],
  userAnswers: Record<string, string | string[]>,
  correctAnswers: Record<string, string>
): { correct_count: number; total_count: number } {
  const total_count = Object.keys(correctAnswers).length
  let correct_count = 0

  for (const q of questions) {
    const subIds = getSubIds(q)

    if (q.type === 'choice_multi') {
      // Each subId has one correct answer; user answer is a string[] on q.id
      const userArr = (userAnswers[q.id] as string[] | undefined) ?? []
      const correctSet = new Set(subIds.map(sid => normalizeAnswer(correctAnswers[sid] ?? '')))
      const userSet = new Set(userArr.map(normalizeAnswer))
      if (
        correctSet.size === userSet.size &&
        [...correctSet].every(v => userSet.has(v))
      ) {
        correct_count += subIds.length
      }
    } else if (q.type === 'fill_blank_summary') {
      for (const sid of subIds) {
        const userVal = normalizeAnswer((userAnswers[sid] as string) ?? '')
        if (userVal && userVal === normalizeAnswer(correctAnswers[sid] ?? '')) {
          correct_count++
        }
      }
    } else if (q.type === 'matching_list') {
      const userRaw = (userAnswers[q.id] as string) ?? ''
      const correctVal = extractLetter(correctAnswers[q.id] ?? '')
      const opts = q.sharedOptions ?? []
      const optLetterFn = (o: string) => o.match(/^([A-Z])[\.\s]/)?.[1] ?? ''
      const optContentFn = (o: string) => o.replace(/^[A-Z]\.?\s+/, '')
      // Validate: single letter, or exact content match (drag stores content only)
      let userLetter: string | null = null
      if (/^[A-Za-z]$/.test(userRaw.trim())) {
        const l = userRaw.trim().toUpperCase()
        if (opts.find(o => optLetterFn(o) === l)) userLetter = l
      } else {
        const contentOpt = opts.find(o => optContentFn(o).trim().toLowerCase() === userRaw.trim().toLowerCase())
        if (contentOpt) userLetter = optLetterFn(contentOpt)
      }
      if (userLetter && userLetter === correctVal) correct_count++
    } else {
      // single value types (matching_paragraph, fill_blank, choice_single, choice_judge)
      const userVal = normalizeAnswer((userAnswers[q.id] as string) ?? '')
      const correctVal = normalizeAnswer(correctAnswers[q.id] ?? '')
      if (userVal && userVal === correctVal) correct_count++
    }
  }

  return { correct_count, total_count }
}
