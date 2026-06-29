'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Timer from '@/components/practice/Timer'
import ReadingPanel from '@/components/practice/ReadingPanel'
import QuestionPanel from '@/components/practice/QuestionPanel'
import NotePanel from '@/components/practice/NotePanel'
import type { ParsedData, PracticeRecord } from '@/lib/utils/practiceHelpers'
import { formatTime } from '@/lib/utils/practiceHelpers'

interface PracticeClientProps {
  pdfId: string
  fileName: string
  parsedData: ParsedData
  initialRecord: PracticeRecord | null
}

export default function PracticeClient({
  pdfId,
  fileName,
  parsedData,
  initialRecord,
}: PracticeClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'practice' | 'review'>(
    initialRecord ? 'review' : 'practice'
  )
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    initialRecord?.answers ?? {}
  )
  const [record, setRecord] = useState<PracticeRecord | null>(initialRecord)
  const [startTime, setStartTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(initialRecord?.time_spent ?? 0)
  const [isPaused, setIsPaused] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showNotePanel, setShowNotePanel] = useState(false)
  const [highlights, setHighlights] = useState<Array<{ id: string; text: string; color: string }>>([])
  const [notes, setNotes] = useState<Array<{ id: string; text: string; content: string }>>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (mode === 'practice' && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      // when pausing, lock in the elapsed time so it resumes correctly
      if (isPaused) setStartTime(Date.now() - elapsed * 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [mode, startTime, isPaused])

  const questionIds = Object.keys(parsedData.answers ?? {})

  const handleAnswerChange = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  const handleFinish = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfId, answers, timeSpent: elapsed }),
      })
      const data = await res.json()
      if (res.ok) {
        setRecord(data.record)
        setShowConfirm(false)
        setMode('review')
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
    setStartTime(Date.now())
    setElapsed(0)
    setMode('practice')
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部栏 */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="text-sm text-gray-600">
          {mode === 'practice' ? (
            <Timer startTime={startTime} />
          ) : (
            <span className="text-gray-400 italic">已提交</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Saved</span>
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
            notes={notes}
            onHighlight={(text) => {
              const id = Date.now().toString()
              setHighlights(prev => [...prev, { id, text, color: 'brown' }])
            }}
            onNote={(text) => {
              const id = Date.now().toString()
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
                  if (confirm('确认退出？当前进度不会保存。')) router.push('/dashboard')
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
              <span>
                正确题数：
                <span className="font-semibold text-green-700">
                  {record?.correct_count ?? '—'} / {record?.total_count ?? '—'}
                </span>
              </span>
              <span>
                用时：<span className="font-semibold">{formatTime(record?.time_spent ?? 0)}</span>
              </span>
              <span>
                提交记录：第 <span className="font-semibold">{record?.attempt_count ?? 1}</span> 次
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
                onClick={() => router.push('/dashboard')}
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
            <p className="text-gray-600 text-sm mb-6">提交后将进入答案查看模式，无法继续作答。</p>
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
