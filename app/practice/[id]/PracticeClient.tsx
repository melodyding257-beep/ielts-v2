'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Timer from '@/components/practice/Timer'
import ReadingPanel from '@/components/practice/ReadingPanel'
import QuestionPanel from '@/components/practice/QuestionPanel'
import NotePanel from '@/components/practice/NotePanel'
import type { ParsedData, PracticeRecord } from '@/lib/utils/practiceHelpers'
import { calculateScore, formatTime, getSubIds } from '@/lib/utils/practiceHelpers'
import type { Highlight } from '@/lib/utils/highlights'

interface PracticeClientProps {
  pdfId: string
  fileName: string
  parsedData: ParsedData
  initialRecord: PracticeRecord | null
  guestMode?: boolean
  onExit?: () => void
}

export default function PracticeClient({
  pdfId,
  fileName,
  parsedData,
  initialRecord,
  guestMode = false,
  onExit,
}: PracticeClientProps) {
  const router = useRouter()
  const hasAnswerKey = parsedData.answerStatus
    ? parsedData.answerStatus === 'complete'
    : Object.keys(parsedData.answers ?? {}).length > 0
  const [mode, setMode] = useState<'practice' | 'review' | 'submitted'>(
    initialRecord ? (hasAnswerKey ? 'review' : 'submitted') : 'practice'
  )
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    initialRecord?.answers ?? {}
  )
  const [record, setRecord] = useState<Pick<PracticeRecord, 'answers' | 'time_spent' | 'correct_count' | 'total_count' | 'attempt_count'> | null>(initialRecord)
  const [elapsed, setElapsed] = useState(initialRecord?.time_spent ?? 0)
  const [isPaused, setIsPaused] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showNotePanel, setShowNotePanel] = useState(false)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [notes, setNotes] = useState<Array<{ id: string; text: string; content: string }>>([])
  useEffect(() => {
    if (mode !== 'practice' || isPaused) return
    const interval = setInterval(() => setElapsed((current) => current + 1), 1000)
    return () => clearInterval(interval)
  }, [mode, isPaused])

  const questionIds = Array.from(new Set((parsedData.questions ?? []).flatMap(getSubIds)))

  const handleAnswerChange = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const handleFinish = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      if (guestMode) {
        const scoring = hasAnswerKey
          ? calculateScore(parsedData.questions ?? [], answers, parsedData.answers ?? {})
          : { correct_count: null, total_count: null }
        setRecord({ answers, time_spent: elapsed, ...scoring, attempt_count: (record?.attempt_count ?? 0) + 1 })
        setShowConfirm(false)
        setMode(hasAnswerKey ? 'review' : 'submitted')
        return
      }
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfId, answers, timeSpent: elapsed }),
      })
      const data = await res.json()
      if (res.ok) {
        setRecord(data.record)
        setShowConfirm(false)
        setMode(hasAnswerKey ? 'review' : 'submitted')
      } else {
        setSubmitError(data.error || '提交失败，请重试')
      }
    } catch (e) {
      console.error('Submit failed:', e)
      setSubmitError('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    setAnswers({})
    setElapsed(0)
    setMode('practice')
  }

  const handleExit = () => {
    if (guestMode) {
      if (onExit) onExit()
      else router.push('/')
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部栏 */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="text-sm text-gray-600">
          {mode === 'practice' ? (
            <Timer seconds={elapsed} />
          ) : (
            <span className="text-gray-400 italic">已提交</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!hasAnswerKey && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              无答案
            </span>
          )}
          <span className="text-sm text-gray-500">{guestMode ? '游客模式 · 不保存' : mode === 'practice' ? '练习中 · 提交后保存' : '作答已保存'}</span>
          {/* wifi */}
          <button className="p-2 hover:bg-gray-100 rounded" tabIndex={-1}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </button>
          {/* bell */}
          <button className="p-2 hover:bg-gray-100 rounded" tabIndex={-1}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* menu */}
          <button className="p-2 hover:bg-gray-100 rounded" tabIndex={-1}>
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* note/edit */}
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => setShowNotePanel(v => !v)}
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`transition-all duration-300 ${showNotePanel ? 'w-1/3' : 'w-1/2'} border-r border-gray-200 overflow-hidden`}>
          <ReadingPanel
            title={fileName}
            content={parsedData}
            highlights={highlights}
            onHighlight={(selection) => {
              const id = crypto.randomUUID()
              setHighlights(prev => [...prev, { id, ...selection, color: 'brown' }])
            }}
            onNote={(text) => {
              const id = crypto.randomUUID()
              setNotes(prev => [...prev, { id, text, content: '' }])
              setShowNotePanel(true)
            }}
            onClearHighlight={(id) => setHighlights(prev => prev.filter(h => h.id !== id))}
          />
        </div>

        <div className={`transition-all duration-300 ${showNotePanel ? 'w-1/3' : 'w-1/2'} overflow-hidden`}>
          <QuestionPanel
            questions={parsedData.questions ?? []}
            answers={answers}
            mode={mode}
            correctAnswers={parsedData.answers ?? {}}
            locations={parsedData.locations ?? {}}
            explanations={parsedData.explanations ?? {}}
            onAnswerChange={handleAnswerChange}
          />
        </div>

        {showNotePanel && (
          <NotePanel
            key={notes.at(-1)?.id ?? 'empty'}
            notes={notes}
            onClose={() => setShowNotePanel(false)}
            onDelete={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
            onUpdate={(id, content) =>
              setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n))
            }
          />
        )}
      </div>

      {/* 底部栏 */}
      <footer className="border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        {mode === 'practice' ? (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs mr-1">P1</span>
              {questionIds.map((qid) => (
                <button
                  key={qid}
                  className={`text-xs px-1 py-0 ${
                    answers[qid] !== undefined && answers[qid] !== '' && (answers[qid] as string).length > 0
                      ? 'text-black underline'
                      : 'text-black'
                  }`}
                  style={{ border: 'none', background: 'none' }}
                >
                  {qid}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono text-gray-700">{formatTime(elapsed)}</span>
              <button
                onClick={() => setShowConfirm(true)}
                className="text-xs rounded px-2 py-2 transition-colors"
                style={{ backgroundColor: 'rgb(234,234,234)', border: '0.8px solid rgb(225,225,225)', borderRadius: 4 }}
              >
                Finish section
              </button>
              <button
                onClick={() => setIsPaused(v => !v)}
                className="text-xs rounded px-2 py-2 transition-colors"
                style={{ backgroundColor: 'rgb(234,234,234)', border: '0.8px solid rgb(225,225,225)', borderRadius: 4 }}
              >
                {isPaused ? 'Continue' : 'Pause'}
              </button>
              <button
                onClick={() => {
                  if (confirm('确认退出？当前进度不会保存。')) handleExit()
                }}
                className="text-xs rounded px-2 py-2 transition-colors"
                style={{ backgroundColor: 'rgb(234,234,234)', border: '0.8px solid rgb(225,225,225)', borderRadius: 4 }}
              >
                Exit
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm text-gray-700">
              {hasAnswerKey ? (
                <span>
                  正确题数：
                  <span className="font-semibold text-green-700">
                    {record?.correct_count ?? '—'} / {record?.total_count ?? '—'}
                  </span>
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
                  {guestMode ? '上传材料没有答案，无法自动批改；本次作答不会保存' : '无答案：已保存作答，无法自动评分'}
                </span>
              )}
              <span>
                用时：<span className="font-semibold">{formatTime(record?.time_spent ?? 0)}</span>
              </span>
              <span>
                {guestMode ? '本次练习' : '提交记录'}：第 <span className="font-semibold">{record?.attempt_count ?? 1}</span> 次
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetry}
                className="px-5 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-sm"
              >
                再练一次
              </button>
              <button
                onClick={handleExit}
                className="px-5 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors text-sm"
              >
                退出
              </button>
            </div>
          </div>
        )}
      </footer>

      {/* Finish 确认框 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">确认提交？</h3>
            <p className="text-gray-600 text-sm mb-6">
              {hasAnswerKey
                ? '提交后将进入答案查看模式，无法继续作答。'
                : guestMode
                  ? '该文件没有答案，提交后无法自动批改；本次作答和用时不会保存。'
                  : '该文件没有答案。提交后会保存你的作答和用时，但不会自动评分。'}
            </p>
            {submitError && (
              <p className="text-red-600 text-sm mb-4">{submitError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setSubmitError('') }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 text-sm disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? '提交中…' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
