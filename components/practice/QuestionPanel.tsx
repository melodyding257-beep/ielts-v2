'use client'

import React, { useState } from 'react'
import type { BackendQuestion } from '@/lib/utils/practiceHelpers'
import { getSubIds, parseSummaryText, parseFillText, normalizeAnswer, extractLetter } from '@/lib/utils/practiceHelpers'

interface QuestionPanelProps {
  questions: BackendQuestion[]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  locations: Record<string, string>
  explanations: Record<string, string>
  onAnswerChange: (id: string, value: string | string[]) => void
}

/* ─── RenderUnit: group matching_paragraph and matching_list by sectionTitle ─── */
type RenderUnit =
  | { kind: 'single'; q: BackendQuestion }
  | { kind: 'mp_group'; questions: BackendQuestion[]; options: string[]; sectionTitle: string; direction: string }
  | { kind: 'ml_group'; questions: BackendQuestion[]; sharedOptions: string[]; sectionTitle: string; direction: string }

function buildRenderUnits(questions: BackendQuestion[]): RenderUnit[] {
  const units: RenderUnit[] = []
  let i = 0
  while (i < questions.length) {
    const q = questions[i]

    if (q.type === 'matching_paragraph') {
      const group: BackendQuestion[] = [q]
      let j = i + 1
      while (j < questions.length && questions[j].type === 'matching_paragraph' && questions[j].sectionTitle === q.sectionTitle) {
        group.push(questions[j])
        j++
      }
      units.push({
        kind: 'mp_group',
        questions: group,
        options: q.options ?? [],
        sectionTitle: q.sectionTitle,
        direction: q.direction,
      })
      i = j

    } else if (q.type === 'matching_list') {
      const group: BackendQuestion[] = [q]
      let j = i + 1
      while (j < questions.length && questions[j].type === 'matching_list' && questions[j].sectionTitle === q.sectionTitle) {
        group.push(questions[j])
        j++
      }
      units.push({
        kind: 'ml_group',
        questions: group,
        sharedOptions: q.sharedOptions ?? [],
        sectionTitle: q.sectionTitle,
        direction: q.direction,
      })
      i = j

    } else {
      units.push({ kind: 'single', q })
      i++
    }
  }
  return units
}

/* ─── Main Panel ─── */

export default function QuestionPanel({
  questions,
  answers,
  mode,
  correctAnswers,
  locations,
  explanations,
  onAnswerChange,
}: QuestionPanelProps) {
  const [expandedExp, setExpandedExp] = useState<Set<string>>(new Set())

  const toggleExp = (id: string) => {
    setExpandedExp(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No questions available
      </div>
    )
  }

  const units = buildRenderUnits(questions)
  let lastSectionTitle = ''
  let lastDirection = ''

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {units.map((unit, unitIdx) => {

        /* ── matching_paragraph group → table ── */
        if (unit.kind === 'mp_group') {
          const showSection = unit.sectionTitle && unit.sectionTitle !== lastSectionTitle
          const showDirection = unit.direction && unit.direction !== lastDirection
          if (showSection) lastSectionTitle = unit.sectionTitle
          if (showDirection) lastDirection = unit.direction
          return (
            <div key={`mp-${unitIdx}`}>
              {showSection && <SectionHeader title={unit.sectionTitle} />}
              {showDirection && <Direction text={unit.direction} />}
              <MatchingParagraphGroup
                questions={unit.questions}
                options={unit.options}
                answers={answers}
                mode={mode}
                correctAnswers={correctAnswers}
                onAnswerChange={(id, val) => onAnswerChange(id, val)}
              />
              {mode === 'review' && (
                <ExpBlock
                  ids={unit.questions.map(q => q.id)}
                  locations={locations}
                  explanations={explanations}
                  expKey={unit.questions[0].id}
                  expanded={expandedExp}
                  onToggle={toggleExp}
                />
              )}
            </div>
          )
        }

        /* ── matching_list group ── */
        if (unit.kind === 'ml_group') {
          const showSection = unit.sectionTitle && unit.sectionTitle !== lastSectionTitle
          const showDirection = unit.direction && unit.direction !== lastDirection
          if (showSection) lastSectionTitle = unit.sectionTitle
          if (showDirection) lastDirection = unit.direction
          return (
            <div key={`ml-${unitIdx}`}>
              {showSection && <SectionHeader title={unit.sectionTitle} />}
              {showDirection && <Direction text={unit.direction} />}
              <MatchingListGroup
                questions={unit.questions}
                sharedOptions={unit.sharedOptions}
                direction={unit.direction}
                answers={answers}
                mode={mode}
                correctAnswers={correctAnswers}
                onAnswerChange={(id, val) => onAnswerChange(id, val)}
              />
              {mode === 'review' && (
                <ExpBlock
                  ids={unit.questions.map(q => q.id)}
                  locations={locations}
                  explanations={explanations}
                  expKey={unit.questions[0].id}
                  expanded={expandedExp}
                  onToggle={toggleExp}
                />
              )}
            </div>
          )
        }

        /* ── single question ── */
        const { q } = unit
        const showSection = q.sectionTitle && q.sectionTitle !== lastSectionTitle
        const showDirection = q.direction && q.direction !== lastDirection
        if (showSection) lastSectionTitle = q.sectionTitle
        if (showDirection) lastDirection = q.direction
        const subIds = getSubIds(q)
        const expKey = subIds[0]

        return (
          <div key={q.id}>
            {showSection && <SectionHeader title={q.sectionTitle} />}
            {showDirection && <Direction text={q.direction} />}
            <QuestionItem
              q={q}
              subIds={subIds}
              answers={answers}
              mode={mode}
              correctAnswers={correctAnswers}
              onAnswerChange={onAnswerChange}
            />
            {mode === 'review' && (
              <ExpBlock
                ids={subIds}
                locations={locations}
                explanations={explanations}
                expKey={expKey}
                expanded={expandedExp}
                onToggle={toggleExp}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── small helpers ─── */

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
    </div>
  )
}

function Direction({ text }: { text: string }) {
  return (
    <p className="mb-4 text-base text-gray-900 italic whitespace-pre-line leading-relaxed">
      {text}
    </p>
  )
}

function ExpBlock({ ids, locations, explanations, expKey, expanded, onToggle }: {
  ids: string[]
  locations: Record<string, string>
  explanations: Record<string, string>
  expKey: string
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const hasAny = ids.some(id => locations[id] || explanations[id])
  return (
    <div className="mt-2 ml-2">
      <button onClick={() => onToggle(expKey)} className="text-xs text-blue-600 hover:underline">
        {expanded.has(expKey) ? '收起解析' : '解析'}
      </button>
      {expanded.has(expKey) && (
        <div className="mt-2 p-3 bg-blue-50 rounded text-sm text-gray-700 space-y-3">
          {hasAny ? ids.map(id => {
            const loc = locations[id]
            const exp = explanations[id]
            if (!loc && !exp) return null
            return (
              <div key={id}>
                <span className="font-semibold text-gray-900">{id}. </span>
                {loc && <p className="mt-0.5 text-gray-500 italic">{loc}</p>}
                {exp && <p className="mt-0.5">{exp}</p>}
              </div>
            )
          }) : <p>暂无解析</p>}
        </div>
      )}
    </div>
  )
}

/* ─── per-question dispatcher ─── */

function QuestionItem({ q, subIds, answers, mode, correctAnswers, onAnswerChange }: {
  q: BackendQuestion
  subIds: string[]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string | string[]) => void
}) {
  switch (q.type) {
    case 'choice_single':
    case 'choice_judge':
      return <ChoiceSingle q={q} answers={answers} mode={mode} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} />
    case 'choice_multi':
      return <ChoiceMulti q={q} subIds={subIds} answers={answers} mode={mode} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} />
    case 'fill_blank':
      return <FillBlank q={q} answers={answers} mode={mode} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} />
    case 'fill_blank_summary':
      return <FillBlankSummary q={q} subIds={subIds} answers={answers} mode={mode} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} />
    default:
      return null
  }
}

/* ─── choice_single / choice_judge ─── */

function ChoiceSingle({ q, answers, mode, correctAnswers, onAnswerChange }: {
  q: BackendQuestion
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  const userAns = normalizeAnswer((answers[q.id] as string) ?? '')
  const correctAns = normalizeAnswer(correctAnswers[q.id] ?? '')

  const isUnanswered = mode === 'review' && !userAns

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <div className="flex-1">
        {q.text && (
          <p className="mb-3 text-base text-gray-900">
            {q.text}
            {isUnanswered && <span className="ml-2 text-red-500 text-sm font-medium">未作答</span>}
          </p>
        )}
        <div className="space-y-1">
          {(q.options ?? []).map((opt) => {
            const letterMatch = opt.match(/^([A-Z])\./)
            const letter = normalizeAnswer(letterMatch ? letterMatch[1] : opt)
            const isUserPick = userAns === letter
            const isCorrectOpt = correctAns === letter

            let borderCol = 'border-gray-400'
            let dotColor = ''
            let rowBg = ''
            let textColor = 'text-gray-900'

            if (mode === 'review') {
              if (isCorrectOpt) {
                borderCol = 'border-green-500'; dotColor = 'bg-green-500'
                rowBg = 'bg-green-50'; textColor = 'text-green-700'
              } else if (isUserPick) {
                borderCol = 'border-red-500'; dotColor = 'bg-red-500'
                rowBg = 'bg-red-50'; textColor = 'text-red-600'
              }
            } else if (isUserPick) {
              borderCol = 'border-blue-500'; dotColor = 'bg-blue-500'; rowBg = 'bg-blue-50'
            }
            const outerClass = `w-3.5 h-3.5 rounded-full border-2 ${borderCol} bg-white shrink-0`
            const innerDot = dotColor ? <span className={`w-2 h-2 rounded-full ${dotColor} block`} /> : null

            return (
              <div
                key={opt}
                onClick={() => mode === 'practice' && onAnswerChange(q.id, letter)}
                className={`flex items-center gap-3 px-2 py-1.5 rounded ${rowBg} ${mode === 'practice' ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}
              >
                <div className={`${outerClass} flex items-center justify-center`}>{innerDot}</div>
                <span className={`text-base ${textColor}`}>{opt}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── choice_multi ─── */

function ChoiceMulti({ q, subIds, answers, mode, correctAnswers, onAnswerChange }: {
  q: BackendQuestion
  subIds: string[]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string[]) => void
}) {
  const userArr: string[] = (answers[q.id] as string[] | undefined) ?? []
  const correctSet = new Set(subIds.map(sid => normalizeAnswer(correctAnswers[sid] ?? '')))

  const toggle = (letter: string) => {
    const cur = [...userArr]
    if (cur.includes(letter)) {
      onAnswerChange(q.id, cur.filter(x => x !== letter))
    } else if (cur.length < (q.selectCount ?? 2)) {
      onAnswerChange(q.id, [...cur, letter])
    }
  }

  const isUnansweredMulti = mode === 'review' && userArr.length === 0

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <div className="flex-1">
        {q.text && (
          <p className="mb-3 text-base text-gray-900">
            {q.text}
            {isUnansweredMulti && <span className="ml-2 text-red-500 text-sm font-medium">未作答</span>}
          </p>
        )}
        <div className="space-y-1">
          {(q.options ?? []).map((opt) => {
            const letterMatch = opt.match(/^([A-Z])\./)
            const letter = normalizeAnswer(letterMatch ? letterMatch[1] : opt)
            const isUserPick = userArr.includes(letter)
            const isCorrectOpt = correctSet.has(letter)

            let boxClass = 'w-4 h-4 rounded border-2 border-gray-400 shrink-0 mt-0.5 flex items-center justify-center'
            let checkColor = 'text-white'
            if (mode === 'review') {
              if (isCorrectOpt) boxClass = 'w-4 h-4 rounded border-2 border-green-500 bg-green-500 shrink-0 mt-0.5 flex items-center justify-center'
              else if (isUserPick) boxClass = 'w-4 h-4 rounded border-2 border-red-500 bg-red-500 shrink-0 mt-0.5 flex items-center justify-center'
            } else if (isUserPick) {
              boxClass = 'w-4 h-4 rounded border-2 border-black bg-black shrink-0 mt-0.5 flex items-center justify-center'
            }

            const showCheck = mode === 'review' ? (isCorrectOpt || isUserPick) : isUserPick

            return (
              <div
                key={opt}
                onClick={() => mode === 'practice' && toggle(letter)}
                className={`flex items-start gap-3 px-2 py-1.5 rounded ${mode === 'practice' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
              >
                <span className={boxClass}>
                  {showCheck && (
                    <svg className={`w-2.5 h-2.5 ${checkColor}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className="text-base text-gray-900">{opt}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── matching_paragraph → TABLE ─── */

function MatchingParagraphGroup({ questions, options, answers, mode, correctAnswers, onAnswerChange }: {
  questions: BackendQuestion[]
  options: string[]   // e.g. ["A","B","C","D","E","F","G","H","I"]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 px-3 py-2 bg-white text-left font-normal text-gray-400" />
            {options.map(col => (
              <th key={col} className="border border-gray-300 px-2 py-2 bg-white text-center font-bold text-gray-900 w-10">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => {
            const userAns = normalizeAnswer((answers[q.id] as string) ?? '')
            const correctAns = normalizeAnswer(correctAnswers[q.id] ?? '')

            return (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-3 py-2 text-gray-900 text-base leading-snug">
                  <span className="font-semibold mr-2">{q.id}</span>
                  {q.text}
                  {mode === 'review' && !userAns && (
                    <span className="ml-2 text-red-500 text-sm font-medium">未作答</span>
                  )}
                </td>
                {options.map(col => {
                  const letter = normalizeAnswer(col)
                  const isUserPick = userAns === letter
                  const isCorrect = correctAns === letter

                  let outerClass = 'w-3.5 h-3.5 rounded-full border-2 border-gray-400 bg-white flex items-center justify-center mx-auto'
                  let innerDot: React.ReactNode = null
                  let cellBg = ''

                  if (mode === 'review') {
                    if (isCorrect) { outerClass = 'w-3.5 h-3.5 rounded-full border-2 border-green-500 bg-white flex items-center justify-center mx-auto'; innerDot = <span className="w-2 h-2 rounded-full bg-green-500 block shrink-0" /> }
                    else if (isUserPick) { outerClass = 'w-3.5 h-3.5 rounded-full border-2 border-red-500 bg-white flex items-center justify-center mx-auto'; innerDot = <span className="w-2 h-2 rounded-full bg-red-500 block shrink-0" /> }
                  } else if (isUserPick) {
                    outerClass = 'w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-white flex items-center justify-center mx-auto'
                    innerDot = <span className="w-2 h-2 rounded-full bg-blue-500 block shrink-0" />
                    cellBg = 'bg-blue-50'
                  }

                  return (
                    <td
                      key={col}
                      className={`border border-gray-300 px-2 py-2 text-center w-10 ${cellBg} ${mode === 'practice' ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}
                      onClick={() => mode === 'practice' && onAnswerChange(q.id, letter)}
                    >
                      <div className={outerClass}>{innerDot}</div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ─── matching_list group ─── */

function MatchingListGroup({ questions, sharedOptions, direction, answers, mode, correctAnswers, onAnswerChange }: {
  questions: BackendQuestion[]
  sharedOptions: string[]
  direction: string
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  const [draggingOpt, setDraggingOpt] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)

  // "NB You may use any letter more than once" → options don't disappear
  const allowRepeat = /NB|may use any letter more than once/i.test(direction)

  // handles both "A. village scene" and "A village scene"
  const optLetter = (opt: string) => opt.match(/^([A-Z])[\.\s]/)?.[1] ?? ''
  const optContent = (opt: string) => opt.replace(/^[A-Z]\.?\s+/, '')

  /**
   * Validate an answer string against the shared options.
   * Returns the matched option letter (e.g. "A") or null if invalid.
   * Valid forms:
   *   1. Exact sharedOption string (drag result)  e.g. "A. village scene"
   *   2. Single letter A-Z (case insensitive)       e.g. "A" or "a"
   *   3. Exact content string (case insensitive)    e.g. "village scene"
   * Invalid: "A. village scene" typed manually would be valid only if it exactly matches a sharedOption.
   */
  const validateAns = (ans: string): string | null => {
    if (!ans.trim()) return null
    // 1. Single letter A-Z (drag result is content, so this handles typed letters only)
    if (/^[A-Za-z]$/.test(ans.trim())) {
      const letter = ans.trim().toUpperCase()
      if (sharedOptions.find(o => optLetter(o) === letter)) return letter
    }
    // 2. Exact option content match (drag stores content, or user typed content)
    const contentOpt = sharedOptions.find(o => optContent(o).trim().toLowerCase() === ans.trim().toLowerCase())
    if (contentOpt) return optLetter(contentOpt)
    return null
  }

  /** Display value shown in the input box — stored value is already content or letter */
  const toDisplayVal = (ans: string): string => ans

  // Which option letters are currently in use (for hiding pool options)
  const usedLetters: Set<string> = allowRepeat
    ? new Set()
    : new Set(questions.map(q => validateAns((answers[q.id] as string) ?? '') ?? '').filter(Boolean))

  return (
    <div className="flex gap-3">
      {/* 左：题目列表 */}
      <div className="w-[70%] space-y-2">
        {questions.map((q) => {
          const userAns = (answers[q.id] as string) ?? ''
          const correctAns = correctAnswers[q.id] ?? ''
          const correctLetter = extractLetter(correctAns)
          const userLetter = validateAns(userAns)
          const isCorrect = !!userLetter && userLetter === correctLetter

          // Correct option full content for review display
          const correctOptFull = sharedOptions.find(o => optLetter(o) === correctLetter)
          const correctDisplay = correctOptFull ? optContent(correctOptFull) : correctLetter

          if (mode === 'review') {
            // Build display for user's answer
            const userDisplay = userAns
              ? (userLetter
                  ? toDisplayVal(userAns)  // valid answer - show content
                  : userAns)               // invalid answer - show as typed
              : ''

            return (
              <div key={q.id} className="flex items-center gap-2 py-0.5">
                <span className="text-base text-gray-900 flex-1">{q.id}. {q.text}</span>
                <span
                  className="shrink-0 inline-flex items-center"
                  style={{ width: 200, height: 35, padding: '4px 8px', border: '0.8px solid rgb(128,128,128)' }}
                >
                  {isCorrect
                    ? <span style={{ color: 'black' }}>{userDisplay}</span>
                    : <>
                        <span style={{ color: 'red' }}>{userDisplay || '未作答'}</span>
                        <span style={{ color: 'green', marginLeft: 6 }}>{correctDisplay}</span>
                      </>
                  }
                </span>
              </div>
            )
          }

          return (
            <div
              key={q.id}
              className="flex items-center gap-2 py-0.5"
              onDragOver={(e) => { e.preventDefault(); setDragOverId(q.id) }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault()
                // drag: store content only (no letter prefix)
                if (draggingOpt) onAnswerChange(q.id, optContent(draggingOpt))
                setDragOverId(null)
                setDraggingOpt(null)
              }}
            >
              <span className="text-base text-gray-900 flex-1">{q.id}. {q.text}</span>
              <input
                type="text"
                value={toDisplayVal(userAns)}
                onChange={(e) => {
                  // Store as typed; validation happens at display/score time
                  onAnswerChange(q.id, e.target.value)
                }}
                placeholder={`${q.id}拖拽或输入选项字母`}
                className="shrink-0 focus:outline-none text-base bg-transparent"
                style={{
                  width: 200, height: 35, padding: '4px 8px', borderRadius: 0,
                  border: `0.8px solid ${dragOverId === q.id ? 'rgb(59,130,246)' : 'rgb(128,128,128)'}`
                }}
              />
            </div>
          )
        })}
      </div>

      {/* 右：共享选项（可拖拽）*/}
      {sharedOptions.length > 0 && mode === 'practice' && (
        <div className="flex-1 pl-2">
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 8px', backgroundColor: 'rgb(239,239,239)' }}>
            {sharedOptions.map((opt) => {
              const letter = optLetter(opt)
              const isUsed = usedLetters.has(letter)
              return (
                <li
                  key={opt}
                  draggable={!isUsed}
                  onDragStart={!isUsed ? () => setDraggingOpt(opt) : undefined}
                  onDragEnd={() => { setDraggingOpt(null); setDragOverId(null) }}
                  style={{
                    backgroundColor: 'white',
                    lineHeight: '29.4px',
                    visibility: isUsed ? 'hidden' : 'visible'
                  }}
                  className={`text-base font-medium select-none my-1 px-2 py-0.5 ${!isUsed ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {opt}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── fill_blank ─── */

function FillBlank({ q, answers, mode, correctAnswers, onAnswerChange }: {
  q: BackendQuestion
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  const userAns = (answers[q.id] as string) ?? ''
  const correctAns = correctAnswers[q.id] ?? ''
  const { before, after } = parseFillText(q.text ?? '')

  const isCorrect = normalizeAnswer(userAns) === normalizeAnswer(correctAns)

  const answerBox = mode === 'review' ? (
    <span
      className="inline-flex items-center align-middle mx-1"
      style={{ height: 35, minWidth: 134, padding: '4px 8px', border: '0.8px solid rgb(128,128,128)', verticalAlign: 'middle' }}
    >
      {isCorrect
        ? <span style={{ color: 'black' }}>{userAns}</span>
        : <>
            <span style={{ color: 'red' }}>{userAns || '未作答'}</span>
            <span style={{ color: 'green', marginLeft: 4 }}>{correctAns}</span>
          </>
      }
    </span>
  ) : (
    <input
      type="text"
      value={userAns}
      onChange={(e) => onAnswerChange(q.id, e.target.value)}
      placeholder={q.id}
      className="inline-block align-middle bg-transparent focus:outline-none text-base mx-1"
      style={{ width: 134, height: 35, padding: '4px 8px', borderRadius: 0, border: '0.8px solid rgb(128,128,128)' }}
    />
  )

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <p className="flex-1 text-base text-gray-900 leading-loose">
        {before}{answerBox}{after}
      </p>
    </div>
  )
}

/* ─── fill_blank_summary ─── */

function FillBlankSummary({ q, subIds, answers, mode, correctAnswers, onAnswerChange }: {
  q: BackendQuestion
  subIds: string[]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  const segments = parseSummaryText(q.text)

  return (
    <p className="text-base text-gray-900 leading-loose">
      {segments.map((seg, i) => (
        <span key={i}>
          {seg.before}
          {seg.id && (() => {
            const userAns = (answers[seg.id] as string) ?? ''
            const correctAns = correctAnswers[seg.id] ?? ''
            const isCorrect = normalizeAnswer(userAns) === normalizeAnswer(correctAns)
            if (mode === 'review') {
              return (
                <span
                  key={seg.id}
                  className="inline-flex items-center align-middle mx-1"
                  style={{ height: 35, minWidth: 134, padding: '4px 8px', border: '0.8px solid rgb(128,128,128)', verticalAlign: 'middle' }}
                >
                  {isCorrect
                    ? <span style={{ color: 'black' }}>{userAns}</span>
                    : <>
                        <span style={{ color: 'red' }}>{userAns || '未作答'}</span>
                        <span style={{ color: 'green', marginLeft: 4 }}>{correctAns}</span>
                      </>
                  }
                </span>
              )
            }
            return (
              <input
                key={seg.id}
                type="text"
                value={userAns}
                onChange={(e) => onAnswerChange(seg.id, e.target.value)}
                placeholder={seg.id}
                className="inline-block align-middle bg-transparent focus:outline-none text-base mx-1"
                style={{ width: 134, height: 35, padding: '4px 8px', borderRadius: 0, border: '0.8px solid rgb(128,128,128)' }}
              />
            )
          })()}
        </span>
      ))}
    </p>
  )
}
