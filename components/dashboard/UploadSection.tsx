'use client'

import { useEffect, useState } from 'react'
import type { ParsedData } from '@/lib/utils/practiceHelpers'

interface UploadSectionProps {
  onUploadSuccess: () => void
  onParsed?: (parsed: ParsedData, fileName: string) => void
  guestMode?: boolean
}

export default function UploadSection({ onUploadSuccess, onParsed, guestMode = false }: UploadSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState('')
  const [lastTiming, setLastTiming] = useState<{ backendMs?: number; endToEndMs: number } | null>(null)

  useEffect(() => {
    if (!uploading) return
    const interval = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
    return () => window.clearInterval(interval)
  }, [uploading])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const extensionOf = (file: File) => file.name.split('.').pop()?.toLowerCase() ?? ''
    const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp'])
    const pdfFiles = files.filter((file) => extensionOf(file) === 'pdf')
    const imageFiles = files.filter((file) => imageExtensions.has(extensionOf(file)))
    const isSinglePdf = files.length === 1 && pdfFiles.length === 1
    const isImageBatch = imageFiles.length === files.length

    if (!isSinglePdf && !isImageBatch) {
      setError('一次只能上传一个 PDF，或选择一组属于同一篇阅读的图片，不能混合上传')
      input.value = ''
      return
    }

    if (isImageBatch && files.length > 10) {
      setError('一次最多上传 10 张图片')
      input.value = ''
      return
    }

    setUploading(true)
    setElapsedSeconds(0)
    setError('')
    setLastTiming(null)

    try {
      const uploadStartedAt = performance.now()
      const formData = new FormData()
      for (const file of files) {
        formData.append('files', file)
      }
      if (guestMode) formData.append('guestMode', 'true')

      const response = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      const endToEndMs = Math.round(performance.now() - uploadStartedAt)
      if (data.parseRunStored && data.parseRunId) {
        void fetch('/api/parse-runs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: data.parseRunId, endToEndMs }),
        }).catch((timingError) => console.warn('Failed to store end-to-end timing', timingError))
      }

      if (!response.ok) {
        throw new Error(data.error || '上传失败')
      }

      setLastTiming({ backendMs: data.timing?.backendTotalMs, endToEndMs })

      onUploadSuccess()
      onParsed?.(data.parsed, files[0].name)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setUploading(false)
      // Allow selecting the same file again after either success or failure.
      input.value = ''
    }
  }

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">上传练习材料</h3>
        <p className="text-gray-500 mb-2">支持单个 PDF，或同一篇阅读的多张图片</p>
        <p className="text-sm text-gray-400 mb-6">多张图片将按文件名顺序作为连续页面解析，最多 10 张</p>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,image/jpeg,image/png,image/webp,image/bmp"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`inline-block px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {uploading ? `解析中 · ${elapsedSeconds} 秒` : '选择文件'}
        </label>
        <p className="text-sm text-gray-400 mt-4">
          {uploading ? '正在识别文章和题目，完成后将自动进入练习' : '选择文件开始解析'}
        </p>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {lastTiming && !error && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          解析完成：后端 {lastTiming.backendMs !== undefined ? `${(lastTiming.backendMs / 1000).toFixed(2)} 秒` : '—'}，用户总等待 {(lastTiming.endToEndMs / 1000).toFixed(2)} 秒。
        </div>
      )}
    </div>
  )
}
