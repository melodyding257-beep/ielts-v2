import type { BackendQuestion } from '../../types/practice'

export type * from '../../types/practice'

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

/** Present an older, split summary result as one continuous exercise.
 * This changes only the display shape; answers remain keyed by their original ids.
 */
export function coalesceSummaryQuestions(questions: BackendQuestion[]): BackendQuestion[] {
  const result: BackendQuestion[] = []
  for (let index = 0; index < questions.length;) {
    const first = questions[index]
    const range = first.sectionTitle?.match(/Questions?\s+(\d+)\s*[-–—]\s*(\d+)/i)
    if (first.type !== 'fill_blank' || !range) {
      result.push(first)
      index++
      continue
    }

    const firstId = Number(range[1])
    const lastId = Number(range[2])
    const count = lastId - firstId + 1
    const group = questions.slice(index, index + count)
    const sectionKey = first.sectionTitle.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
    if (count < 2 || count > 20 || group.length !== count ||
        !group.every((question, offset) => question.type === 'fill_blank' &&
          (!question.sectionTitle ||
            question.sectionTitle.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase() === sectionKey) &&
          Number(question.id) === firstId + offset) ||
        !group.some((question) => /\bsummary\b/i.test(question.direction ?? ''))) {
      result.push(first)
      index++
      continue
    }

    const expectedIds = Array.from({ length: count }, (_, offset) => String(firstId + offset))
    const completeFragment = group.find((question) =>
      expectedIds.every((id) => new RegExp(`(?:^|\\D)${id}\\s*_{3,}`).test(question.text ?? ''))
    )
    let text = completeFragment?.text.replace(/\s+/g, ' ').trim() ?? ''
    for (const question of group) {
      if (completeFragment) break
      let fragment = String(question.text ?? '').replace(/\s+/g, ' ').trim()
      fragment = fragment.replace(new RegExp(`^${question.id}[.)]\\s*`), '')
      if (!new RegExp(`(?:^|\\D)${question.id}\\s*_{3,}`).test(fragment) &&
          (fragment.match(/_{3,}/g) ?? []).length === 1) {
        fragment = fragment.replace(/_{3,}/, `${question.id} _______`)
      }
      if (!text) {
        text = fragment
        continue
      }
      let overlap = 0
      for (let length = Math.min(text.length, fragment.length); length >= 16; length--) {
        if (text.slice(-length).toLowerCase() === fragment.slice(0, length).toLowerCase()) {
          overlap = length
          break
        }
      }
      text += ` ${fragment.slice(overlap)}`
    }

    const markers = Array.from(text.matchAll(/(\d+)\s*_{3,}/g))
    const lastMarker = new Map<string, number>()
    markers.forEach((marker, markerIndex) => lastMarker.set(marker[1], markerIndex))
    let cleaned = ''
    let cursor = 0
    markers.forEach((marker, markerIndex) => {
      cleaned += text.slice(cursor, marker.index)
      if (lastMarker.get(marker[1]) === markerIndex) cleaned += `${marker[1]} _______`
      cursor = marker.index + marker[0].length
    })
    cleaned = (cleaned + text.slice(cursor)).replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim()
    const foundIds = Array.from(cleaned.matchAll(/(\d+)\s*_{3,}/g), (marker) => marker[1])
    if (foundIds.join(',') !== expectedIds.join(',')) {
      result.push(...group)
      index += count
      continue
    }
    cleaned = parseSummaryText(cleaned)
      .map((part) => part.before.replace(/_{3,}/g, '') + (part.id ? `${part.id} _______` : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim()

    result.push({
      ...first,
      id: `${firstId}-${lastId}`,
      type: 'fill_blank_summary',
      text: cleaned,
      contentBlocks: null,
    })
    index += count
  }
  return result
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

/**
 * Recover one independent fill-in question when a model accidentally places
 * several numbered blanks in the same text. Valid single-blank text is kept.
 */
export function isolateFillQuestionText(text: string, questionId: string): string {
  const markerRegex = /(\d+)\s*_{3,}/g
  const markers = Array.from(text.matchAll(markerRegex))
  if (markers.length <= 1) return text

  const targetIndex = markers.findIndex((marker) => marker[1] === questionId)
  if (targetIndex < 0) return text

  const target = markers[targetIndex]
  const targetStart = target.index ?? 0
  const targetEnd = targetStart + target[0].length
  const previousEnd = targetIndex === 0
    ? 0
    : (markers[targetIndex - 1].index ?? 0) + markers[targetIndex - 1][0].length
  const nextStart = targetIndex + 1 < markers.length
    ? (markers[targetIndex + 1].index ?? text.length)
    : text.length

  const before = text.slice(previousEnd, targetStart).replace(/^[\s;•]+/, '')
  const after = text.slice(targetEnd, nextStart).split(/[;•\n]/, 1)[0]
  return `${before}${questionId} _______${after}`.trim()
}

export function calculateScore(
  questions: BackendQuestion[],
  userAnswers: Record<string, string | string[]>,
  correctAnswers: Record<string, string>
): { correct_count: number; total_count: number } {
  const total_count = Object.keys(correctAnswers).length
  let correct_count = 0
  const singleAnswer = (id: string) => typeof userAnswers[id] === 'string' ? userAnswers[id] : ''

  for (const q of questions) {
    const subIds = getSubIds(q)

    if (q.type === 'choice_multi') {
      // Each subId has one correct answer; user answer is a string[] on q.id
      const value = userAnswers[q.id]
      const userArr = Array.isArray(value) ? value : []
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
        const userVal = normalizeAnswer(singleAnswer(sid))
        if (userVal && userVal === normalizeAnswer(correctAnswers[sid] ?? '')) {
          correct_count++
        }
      }
    } else if (q.type === 'matching_list') {
      const userRaw = singleAnswer(q.id)
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
      const userVal = normalizeAnswer(singleAnswer(q.id))
      const correctVal = normalizeAnswer(correctAnswers[q.id] ?? '')
      if (userVal && userVal === correctVal) correct_count++
    }
  }

  return { correct_count, total_count }
}
