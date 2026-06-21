'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface PdfFile {
  id: string
  file_name: string
  created_at: string
}

interface PracticeRecordSummary {
  pdf_id: string
  correct_count: number | null
  total_count: number | null
  attempt_count: number
}

export default function FileList() {
  const [pdfs, setPdfs] = useState<PdfFile[]>([])
  const [recordMap, setRecordMap] = useState<Map<string, PracticeRecordSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/pdf/list').then(r => r.json()),
      fetch('/api/practice/records').then(r => r.json()),
    ]).then(([pdfData, recData]) => {
      setPdfs(pdfData.pdfs ?? [])
      const map = new Map<string, PracticeRecordSummary>()
      for (const rec of recData.records ?? []) {
        map.set(rec.pdf_id, rec)
      }
      setRecordMap(map)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (e: React.MouseEvent, pdfId: string, fileName: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`确认删除《${fileName}》？\n此操作不可恢复，做题记录也会一并删除。`)) return

    setDeletingId(pdfId)
    try {
      const res = await fetch('/api/pdf/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfId }),
      })
      if (res.ok) {
        setPdfs(prev => prev.filter(p => p.id !== pdfId))
      } else {
        const data = await res.json()
        alert(data.error || '删除失败，请重试')
      }
    } catch {
      alert('网络错误，请重试')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">加载中…</div>
  }

  if (pdfs.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">暂无上传的文件</div>
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {pdfs.map((pdf) => {
        const rec = recordMap.get(pdf.id)
        const name = pdf.file_name.replace(/\.[^.]+$/, '')
        const isDeleting = deletingId === pdf.id

        return (
          <div key={pdf.id} className="relative group">
            <Link
              href={`/practice/${pdf.id}`}
              className="block border border-gray-200 rounded-xl p-4 hover:border-gray-400 hover:shadow-sm transition-all bg-white"
            >
              {/* file icon */}
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>

              {/* file name */}
              <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{name}</p>

              {/* practice status */}
              {rec ? (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-xs text-green-700">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>正确 {rec.correct_count ?? '—'} / {rec.total_count ?? '—'}</span>
                  </div>
                  <p className="text-xs text-gray-400">已练习 {rec.attempt_count} 次</p>
                </div>
              ) : (
                <div className="h-8" />
              )}
            </Link>

            {/* 删除按钮：hover 时显示 */}
            <button
              onClick={(e) => handleDelete(e, pdf.id, name)}
              disabled={isDeleting}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm disabled:opacity-50"
              title="删除"
            >
              {isDeleting ? (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
