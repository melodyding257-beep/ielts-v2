'use client'

import { DragEvent, useState } from 'react'

type ParseResult = {
  pages?: Array<{ page_num: number; text?: string; is_scan?: boolean; ocr_used?: boolean }>
  total_pages?: number
  article?: string
  questions?: Array<{ id: string; type?: string; text?: string }>
  answers?: Record<string, string>
  locations?: Record<string, string>
  explanations?: Record<string, string>
  answerStatus?: 'complete' | 'none' | 'incomplete' | 'uncertain'
  parseMeta?: {
    runId?: string
    fileHash?: string
    retryCount?: number
    timing?: Record<string, number>
    validation?: { status?: string; errors?: string[]; warnings?: string[] }
  }
  error?: string
  [key: string]: unknown
}

const defaultEndpoint = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default function ParseTester() {
  const [endpoint, setEndpoint] = useState(defaultEndpoint)
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [browserTotalMs, setBrowserTotalMs] = useState<number | null>(null)

  const chooseFiles = (candidates: File[]) => {
    if (!candidates.length) return
    const extension = (candidate: File) => candidate.name.split('.').pop()?.toLowerCase() ?? ''
    const isSinglePdf = candidates.length === 1 && extension(candidates[0]) === 'pdf'
    const isImageBatch = candidates.every((candidate) => ['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(extension(candidate)))
    if (!isSinglePdf && !isImageBatch) {
      setError('一次请选择一个PDF，或一组属于同一篇阅读的图片，不能混合。')
      return
    }
    if (isImageBatch && candidates.length > 10) {
      setError('一次最多选择10张图片。')
      return
    }
    const ordered = isImageBatch
      ? [...candidates].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      : candidates
    setFiles(ordered)
    setResult(null)
    setBrowserTotalMs(null)
    setError('')
  }

  const parse = async () => {
    if (!files.length) return setError('请先选择文件。')
    const url = endpoint.trim().replace(/\/$/, '')
    if (!url) return setError('请填写 FastAPI 地址。')

    setBusy(true)
    setError('')
    setResult(null)
    setBrowserTotalMs(null)
    try {
      const startedAt = performance.now()
      const body = new FormData()
      for (const file of files) body.append('files', file, file.name)
      const response = await fetch(`${url}/parse`, { method: 'POST', body })
      const data = await response.json().catch(() => ({}))
      setBrowserTotalMs(Math.round(performance.now() - startedAt))
      if (!response.ok) {
        const validationErrors = Array.isArray(data.detail?.validation?.errors)
          ? data.detail.validation.errors.join('；')
          : ''
        throw new Error(validationErrors || data.detail?.message || data.detail || data.error || `解析接口返回 ${response.status}`)
      }
      setResult(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求解析接口失败，请检查后端是否启动及 CORS 配置。')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    chooseFiles(Array.from(event.dataTransfer.files ?? []))
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-500">IELTS Reading · API 调试页</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">测试文件解析</h1>
          <p className="mt-3 text-gray-600">此页面会直接调用 FastAPI 的 <code className="rounded bg-gray-200 px-1.5 py-0.5 text-sm">/parse</code>，不经过登录和 Supabase，便于确认模型是否被调用。</p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">FastAPI 地址</label>
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black" placeholder="http://localhost:8000" />

          <div onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={`mt-5 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-black bg-gray-50' : 'border-gray-300'}`}>
            <input id="parse-file" type="file" accept=".pdf,image/*" multiple className="hidden" onChange={(e) => chooseFiles(Array.from(e.target.files ?? []))} />
            <label htmlFor="parse-file" className="cursor-pointer text-sm font-medium text-gray-900 underline underline-offset-4">选择文件</label>
            <p className="mt-2 text-sm text-gray-500">或将 PDF / 图片拖到这里</p>
            {files.length > 0 && <p className="mt-4 text-sm text-gray-700">已选择：<span className="font-medium">{files.map((file) => file.name).join('、')}</span>（{(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB）</p>}
          </div>

          <button onClick={parse} disabled={!files.length || busy} className="mt-5 w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? '正在解析，模型可能需要几十秒…' : '开始解析'}</button>
          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </section>

        {result && <section className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-green-100 px-3 py-1 text-green-800">接口成功</span><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">页数：{result.total_pages ?? result.pages?.length ?? 0}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">题目：{result.questions?.length ?? 0}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">{result.answerStatus === 'none' ? '无答案' : `答案：${Object.keys(result.answers ?? {}).length}`}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">后端：{result.parseMeta?.timing?.backendTotalMs ? `${(result.parseMeta.timing.backendTotalMs / 1000).toFixed(2)}秒` : '—'}</span><span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">浏览器等待：{browserTotalMs ? `${(browserTotalMs / 1000).toFixed(2)}秒` : '—'}</span></div>
          {result.error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">后端提示：{result.error}</div>}
          <div><h2 className="text-lg font-semibold">文章预览</h2><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-sm text-gray-700">{result.article || '（没有返回文章内容）'}</pre></div>
          <details><summary className="cursor-pointer text-sm font-medium text-gray-700">查看完整 JSON</summary><pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{JSON.stringify(result, null, 2)}</pre></details>
        </section>}
      </div>
    </main>
  )
}
