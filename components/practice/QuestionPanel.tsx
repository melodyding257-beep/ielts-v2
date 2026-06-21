'use client'

import { useState } from 'react'
import type { BackendQuestion } from '@/lib/utils/practiceHelpers'
import { getSubIds, parseSummaryText, parseFillText, normalizeAnswer } from '@/lib/utils/practiceHelpers'

interface QuestionPanelProps {
  questions: BackendQuestion[]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  explanations: Record<string, string>
  onAnswerChange: (id: string, value: string | string[]) => void
}

/* ─── Group consecutive matching_list questions with same sectionTitle ─── */
type RenderUnit =
  | { kind: 'single'; q: BackendQuestion }
  | { kind: 'ml_group'; questions: BackendQuestion[]; sharedOptions: string[]; sectionTitle: string; direction: string }

function buildRenderUnits(questions: BackendQuestion[]): RenderUnit[] {
  const units: RenderUnit[] = []
  let i = 0
  while (i < questions.length) {
    const q = questions[i]
    if (q.type === 'matching_list') {
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

export default function QuestionPanel({
  questions,
  answers,
  mode,
  correctAnswers,
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
        if (unit.kind === 'ml_group') {
          const showSection = unit.sectionTitle && unit.sectionTitle !== lastSectionTitle
          const showDirection = unit.direction && unit.direction !== lastDirection
          if (showSection) lastSectionTitle = unit.sectionTitle
          if (showDirection) lastDirection = unit.direction

          return (
            <div key={`ml-${unitIdx}`}>
              {showSection && (
                <div className="mb-3 pb-2 border-b-2 border-gray-300">
                  <h2 className="text-base font-bold">{unit.sectionTitle}</h2>
                </div>
              )}
              {showDirection && (
                <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-700 italic whitespace-pre-line">
                  {unit.direction}
                </div>
              )}
              <MatchingListGroup
                questions={unit.questions}
                sharedOptions={unit.sharedOptions}
                answers={answers}
                mode={mode}
                correctAnswers={correctAnswers}
                onAnswerChange={(id, val) => onAnswerChange(id, val)}
              />
              {/* 解析仅 review 模式显示，显示第一题的解析 */}
              {mode === 'review' && (
                <div className="mt-2 ml-2">
                  <button onClick={() => toggleExp(unit.questions[0].id)} className="text-xs text-blue-600 hover:underline">
                    {expandedExp.has(unit.questions[0].id) ? '收起解析' : '解析'}
                  </button>
                  {expandedExp.has(unit.questions[0].id) && (
                    <div className="mt-2 p-3 bg-blue-50 rounded text-sm text-gray-700 whitespace-pre-line">
                      {unit.questions.map(q => {
                        const exp = explanations[q.id] ?? ''
                        return exp ? <p key={q.id}><span className="font-medium">{q.id}.</span> {exp}</p> : null
                      })}
                      {unit.questions.every(q => !explanations[q.id]) && '暂无解析'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        }

        // single question
        const { q } = unit
        const showSection = q.sectionTitle && q.sectionTitle !== lastSectionTitle
        const showDirection = q.direction && q.direction !== lastDirection
        if (showSection) lastSectionTitle = q.sectionTitle
        if (showDirection) lastDirection = q.direction

        const subIds = getSubIds(q)
        const expKey = subIds[0]
        const expText = explanations[expKey] ?? ''

        return (
          <div key={q.id}>
            {showSection && (
              <div className="mb-3 pb-2 border-b-2 border-gray-300">
                <h2 className="text-base font-bold">{q.sectionTitle}</h2>
              </div>
            )}
            {showDirection && (
              <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-700 italic whitespace-pre-line">
                {q.direction}
              </div>
            )}

            <QuestionItem
              q={q}
              subIds={subIds}
              answers={answers}
              mode={mode}
              correctAnswers={correctAnswers}
              onAnswerChange={onAnswerChange}
            />

            {/* 解析按钮：仅 review 模式 */}
            {mode === 'review' && (
              <div className="mt-1 ml-10">
                <button onClick={() => toggleExp(expKey)} className="text-xs text-blue-600 hover:underline">
                  {expandedExp.has(expKey) ? '收起解析' : '解析'}
                </button>
                {expandedExp.has(expKey) && (
                  <div className="mt-2 p-3 bg-blue-50 rounded text-sm text-gray-700 whitespace-pre-line">
                    {expText || '暂无解析'}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── per-question dispatcher ─── */

function QuestionItem({
  q, subIds, answers, mode, correctAnswers, onAnswerChange,
}: {
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
    case 'matching_paragraph':
      return <MatchingParagraph q={q} answers={answers} mode={mode} correctAnswers={correctAnswers} onAnswerChange={onAnswerChange} />
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

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <div className="flex-1">
        {q.text && <p className="mb-3 text-sm text-gray-800">{q.text}</p>}
        <div className="space-y-1">
          {(q.options ?? []).map((opt) => {
            const letterMatch = opt.match(/^([A-Z])\./)
            const letter = normalizeAnswer(letterMatch ? letterMatch[1] : opt)
            const isUserPick = userAns === letter
            const isCorrect = correctAns === letter

            let dotClass = 'w-4 h-4 rounded-full border-2 border-gray-400 shrink-0 mt-0.5'
            if (mode === 'review') {
              if (isCorrect) dotClass = 'w-4 h-4 rounded-full bg-green-500 border-2 border-green-500 shrink-0 mt-0.5'
              else if (isUserPick) dotClass = 'w-4 h-4 rounded-full bg-red-500 border-2 border-red-500 shrink-0 mt-0.5'
            } else if (isUserPick) {
              dotClass = 'w-4 h-4 rounded-full bg-black border-2 border-black shrink-0 mt-0.5'
            }

            return (
              <div
                key={opt}
                onClick={() => mode === 'practice' && onAnswerChange(q.id, letter)}
                className={`flex items-start gap-3 px-2 py-1.5 rounded ${mode === 'practice' ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
              >
                <span className={dotClass} />
                <span className="text-sm text-gray-700">{opt}</span>
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

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <div className="flex-1">
        {q.text && <p className="mb-3 text-sm text-gray-800">{q.text}</p>}
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
                <span className="text-sm text-gray-700">{opt}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── matching_paragraph ─── */

function MatchingParagraph({ q, answers, mode, correctAnswers, onAnswerChange }: {
  q: BackendQuestion
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  const cols = q.options ?? []
  const userAns = normalizeAnswer((answers[q.id] as string) ?? '')
  const correctAns = normalizeAnswer(correctAnswers[q.id] ?? '')

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <div className="flex-1">
        {q.text && <p className="mb-3 text-sm text-gray-800">{q.text}</p>}
        <div className="flex flex-wrap gap-3">
          {cols.map((col) => {
            const letter = normalizeAnswer(col)
            const isUserPick = userAns === letter
            const isCorrect = correctAns === letter

            let dotClass = 'w-5 h-5 rounded-full border-2 border-gray-300'
            if (mode === 'review') {
              if (isCorrect) dotClass = 'w-5 h-5 rounded-full bg-green-500 border-2 border-green-500'
              else if (isUserPick) dotClass = 'w-5 h-5 rounded-full bg-red-500 border-2 border-red-500'
            } else if (isUserPick) {
              dotClass = 'w-5 h-5 rounded-full bg-black border-2 border-black'
            }

            return (
              <div
                key={col}
                onClick={() => mode === 'practice' && onAnswerChange(q.id, letter)}
                className={`flex items-center gap-1.5 ${mode === 'practice' ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span className={dotClass} />
                <span className="text-sm text-gray-700">{col}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── matching_list group ─── */

function MatchingListGroup({ questions, sharedOptions, answers, mode, correctAnswers, onAnswerChange }: {
  questions: BackendQuestion[]
  sharedOptions: string[]
  answers: Record<string, string | string[]>
  mode: 'practice' | 'review'
  correctAnswers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}) {
  if (mode === 'review') {
    return (
      <div className="space-y-2">
        {questions.map((q) => {
          const userAns = (answers[q.id] as string) ?? ''
          const correctAns = correctAnswers[q.id] ?? ''
          const isCorrect = normalizeAnswer(userAns) === normalizeAnswer(correctAns)
          return (
            <div key={q.id} className="flex gap-3 text-sm">
              <span className="font-bold text-gray-900 min-w-[2rem]">{q.id}.</span>
              <span className="flex-1 text-gray-800">{q.text}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {isCorrect ? (
                  <span className="text-green-700 font-semibold">{correctAns}</span>
                ) : (
                  <>
                    <span className="text-red-500 line-through">{userAns || '未答'}</span>
                    <span className="text-green-700 font-semibold">{correctAns}</span>
                  </>
                )}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {/* question rows in a bordered box */}
      <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`flex items-center gap-3 px-4 py-2.5 bg-white ${idx < questions.length - 1 ? 'border-b border-gray-200' : ''}`}
          >
            <span className="text-sm font-semibold text-gray-800 min-w-[2rem]">{q.id}.</span>
            <span className="flex-1 text-sm text-gray-800">{q.text}</span>
            <input
              type="text"
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => onAnswerChange(q.id, e.target.value.toUpperCase().slice(0, 2))}
              placeholder="—"
              maxLength={2}
              className="w-14 text-center border border-gray-400 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        ))}
      </div>

      {/* shared options list */}
      {sharedOptions.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="space-y-1.5">
            {sharedOptions.map((opt) => (
              <div key={opt} className="text-sm text-gray-700 leading-snug">
                {opt}
              </div>
            ))}
          </div>
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

  if (mode === 'review') {
    const isCorrect = normalizeAnswer(userAns) === normalizeAnswer(correctAns)
    return (
      <div className="flex gap-3">
        <span className="font-bold text-gray-900 min-w-[2rem]">{q.id}.</span>
        <p className="flex-1 text-sm text-gray-800 leading-relaxed">
          {before}
          {isCorrect ? (
            <span className="text-green-700 font-medium border-b border-green-400 mx-1">{correctAns}</span>
          ) : (
            <>
              <span className="text-red-500 line-through mx-1">{userAns || '未答'}</span>
              <span className="text-green-700 font-medium border-b border-green-400 mx-1">{correctAns}</span>
            </>
          )}
          {after}
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <span className="font-bold text-gray-900 min-w-[2rem] pt-0.5">{q.id}.</span>
      <p className="flex-1 text-sm text-gray-800 leading-loose">
        {before}
        <input
          type="text"
          value={userAns}
          onChange={(e) => onAnswerChange(q.id, e.target.value)}
          placeholder="______"
          className="mx-1 w-32 px-2 py-0.5 border-b-2 border-gray-400 focus:border-black outline-none text-sm bg-transparent inline-block"
        />
        {after}
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

  if (mode === 'review') {
    return (
      <p className="text-sm text-gray-800 leading-relaxed">
        {segments.map((seg, i) => (
          <span key={i}>
            {seg.before}
            {seg.id && (() => {
              const userAns = (answers[seg.id] as string) ?? ''
              const correctAns = correctAnswers[seg.id] ?? ''
              const isCorrect = normalizeAnswer(userAns) === normalizeAnswer(correctAns)
              return (
                <span className="inline-flex items-center gap-1 mx-1">
                  <span className="text-xs text-gray-400">{seg.id}</span>
                  {isCorrect ? (
                    <span className="text-green-700 font-medium border-b border-green-400">{correctAns}</span>
                  ) : (
                    <>
                      <span className="text-red-500 line-through">{userAns || '未答'}</span>
                      <span className="text-green-700 font-medium border-b border-green-400">{correctAns}</span>
                    </>
                  )}
                </span>
              )
            })()}
          </span>
        ))}
      </p>
    )
  }

  return (
    <p className="text-sm text-gray-800 leading-loose">
      {segments.map((seg, i) => (
        <span key={i}>
          {seg.before}
          {seg.id && (
            <span className="inline-flex items-center gap-0.5 mx-1">
              <span className="text-xs text-gray-400 align-text-bottom">{seg.id}</span>
              <input
                type="text"
                value={(answers[seg.id] as string) ?? ''}
                onChange={(e) => onAnswerChange(seg.id, e.target.value)}
                placeholder="______"
                className="w-28 px-2 py-0.5 border-b-2 border-gray-400 focus:border-black outline-none text-sm bg-transparent"
              />
            </span>
          )}
        </span>
      ))}
    </p>
  )
}
