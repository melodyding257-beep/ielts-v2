'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ArticleBlock, BackendQuestion, ParseRun } from '@/lib/utils/practiceHelpers'

function formatMs(value?: number) {
  if (value === undefined || value === null) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value}ms`
}

function runSummary(run: ParseRun) {
  const output = run.normalized_output ?? {}
  const blocks = (output.articleBlocks ?? []) as ArticleBlock[]
  const questions = (output.questions ?? []) as BackendQuestion[]
  const labels = blocks.map((block) => block.label?.text).filter(Boolean) as string[]
  const boldRuns = blocks.flatMap((block) => block.runs ?? []).filter((item) => item.bold).length
  const italicRuns = blocks.flatMap((block) => block.runs ?? []).filter((item) => item.italic).length
  return {
    blocks: blocks.length,
    labels,
    questionIds: questions.map((question) => question.id),
    answerCount: Object.keys(output.answers ?? {}).length,
    boldRuns,
    italicRuns,
  }
}

function differenceFromBaseline(run: ParseRun, baseline: ParseRun) {
  if (run.id === baseline.id) return '基准运行'
  const current = runSummary(run)
  const first = runSummary(baseline)
  const differences: string[] = []
  if (current.blocks !== first.blocks) differences.push(`文章块 ${first.blocks}→${current.blocks}`)
  if (current.labels.join(',') !== first.labels.join(',')) differences.push(`标记 ${first.labels.join('/') || '无'}→${current.labels.join('/') || '无'}`)
  if (current.questionIds.join(',') !== first.questionIds.join(',')) differences.push('题号集合变化')
  if (current.answerCount !== first.answerCount) differences.push(`答案数 ${first.answerCount}→${current.answerCount}`)
  if (current.boldRuns !== first.boldRuns) differences.push(`粗体片段 ${first.boldRuns}→${current.boldRuns}`)
  if (current.italicRuns !== first.italicRuns) differences.push(`斜体片段 ${first.italicRuns}→${current.italicRuns}`)
  return differences.length ? differences.join('；') : '结构一致'
}

export default function ParseRunDashboard() {
  const [runs, setRuns] = useState<ParseRun[]>([])
  const [selectedHash, setSelectedHash] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rawByRunId, setRawByRunId] = useState<Record<string, string>>({})

  const loadRuns = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/parse-runs')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '读取解析记录失败')
      const nextRuns = (data.runs ?? []) as ParseRun[]
      setRuns(nextRuns)
      setSelectedHash((current) => current || nextRuns[0]?.file_hash || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取解析记录失败')
    } finally {
      setLoading(false)
    }
  }

  const loadRawOutput = async (runId: string) => {
    if (rawByRunId[runId]) return
    setRawByRunId((current) => ({ ...current, [runId]: '正在读取…' }))
    try {
      const response = await fetch(`/api/parse-runs?runId=${encodeURIComponent(runId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '读取模型原始输出失败')
      setRawByRunId((current) => ({
        ...current,
        [runId]: JSON.stringify(data.run?.raw_output ?? {}, null, 2),
      }))
    } catch (cause) {
      setRawByRunId((current) => ({
        ...current,
        [runId]: cause instanceof Error ? cause.message : '读取模型原始输出失败',
      }))
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/parse-runs')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '读取解析记录失败')
        return data
      })
      .then((data) => {
        if (cancelled) return
        const nextRuns = (data.runs ?? []) as ParseRun[]
        setRuns(nextRuns)
        setSelectedHash(nextRuns[0]?.file_hash || '')
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '读取解析记录失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const groups = useMemo(() => {
    const grouped = new Map<string, ParseRun[]>()
    for (const run of runs) grouped.set(run.file_hash, [...(grouped.get(run.file_hash) ?? []), run])
    return grouped
  }, [runs])
  const selectedRuns = [...(groups.get(selectedHash) ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const baseline = selectedRuns[0]
  const backendTimes = selectedRuns
    .filter((run) => !run.normalized_output?.parseMeta?.cacheHit)
    .map((run) => run.timings?.backendTotalMs)
    .filter((value): value is number => typeof value === 'number')
  const averageBackend = backendTimes.length ? Math.round(backendTimes.reduce((sum, value) => sum + value, 0) / backendTimes.length) : undefined

  if (loading) return <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500">正在读取解析记录…</div>
  if (error) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</div>
  if (!runs.length) return <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500">暂无解析运行。请先从 Dashboard 上传文件。</div>

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="min-w-72 flex-1 text-sm font-medium text-gray-700">
            对比文件
            <select value={selectedHash} onChange={(event) => setSelectedHash(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2">
              {[...groups.entries()].map(([hash, values]) => <option key={hash} value={hash}>{values[0].file_name} · {values.length}次 · {hash.slice(0, 10)}</option>)}
            </select>
          </label>
          <button onClick={() => void loadRuns()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">刷新</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="运行次数" value={String(selectedRuns.length)} />
          <Metric label="平均后端解析" value={formatMs(averageBackend)} />
          <Metric label="最快后端解析" value={formatMs(backendTimes.length ? Math.min(...backendTimes) : undefined)} />
          <Metric label="最慢后端解析" value={formatMs(backendTimes.length ? Math.max(...backendTimes) : undefined)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">后端</th><th className="px-4 py-3">用户等待</th><th className="px-4 py-3">主模型</th><th className="px-4 py-3">复核</th><th className="px-4 py-3">结构差异</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selectedRuns.map((run) => (
                <tr key={run.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-4 text-gray-600">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${run.status === 'passed' ? 'bg-green-100 text-green-800' : run.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{run.status} · {run.answer_status === 'none' ? '无答案' : run.answer_status === 'complete' ? '有答案' : '答案待核对'}</span><div className="mt-2 text-xs text-gray-500">{run.normalized_output?.parseMeta?.cacheHit ? '缓存命中' : `重试 ${run.retry_count}`}</div></td>
                  <td className="whitespace-nowrap px-4 py-4 font-medium">{formatMs(run.timings?.backendTotalMs)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatMs(run.timings?.endToEndMs ?? run.timings?.nextPipelineMs)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatMs(run.timings?.primaryModelMs)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{formatMs(run.timings?.verificationModelMs)}</td>
                  <td className="max-w-md px-4 py-4 text-gray-700">
                    {baseline ? differenceFromBaseline(run, baseline) : '—'}
                    {run.validation_report?.initialErrors?.length ? <details className="mt-2 text-xs text-red-700"><summary className="cursor-pointer">首次校验：{run.validation_report.initialErrors.length}条错误（复核第 {run.validation_report.verificationPages?.join('、') || '未知'} 页）</summary><ul className="mt-1 list-disc pl-4">{run.validation_report.initialErrors.map((validationError) => <li key={validationError}>{validationError}</li>)}</ul></details> : null}
                    {run.validation_report?.errors?.length ? <details className="mt-2 text-xs text-red-700"><summary className="cursor-pointer">{run.validation_report.errors.length}条错误</summary><ul className="mt-1 list-disc pl-4">{run.validation_report.errors.map((validationError) => <li key={validationError}>{validationError}</li>)}</ul></details> : null}
                    {run.validation_report?.warnings?.length ? <details className="mt-2 text-xs text-amber-700"><summary className="cursor-pointer">{run.validation_report.warnings.length}条警告</summary><ul className="mt-1 list-disc pl-4">{run.validation_report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details> : null}
                    <details className="mt-2 text-xs text-gray-600" onToggle={(event) => { if (event.currentTarget.open) void loadRawOutput(run.run_id) }}>
                      <summary className="cursor-pointer">模型原始输出</summary>
                      <pre className="mt-2 max-h-80 max-w-xl overflow-auto whitespace-pre-wrap rounded bg-gray-950 p-3 text-[11px] text-gray-100">{rawByRunId[run.run_id] ?? '点击后读取'}</pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-gray-50 px-4 py-3"><div className="text-xs text-gray-500">{label}</div><div className="mt-1 text-xl font-semibold text-gray-900">{value}</div></div>
}
