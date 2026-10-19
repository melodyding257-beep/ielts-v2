import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ParseRunDashboard from '@/components/parse/ParseRunDashboard'

export default async function ParseTestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">开发工具 · 每次上传均重新解析</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">解析稳定性与耗时</h1>
            <p className="mt-3 text-sm text-gray-600">文件哈希只用于归组比较，不会复用历史解析结果。</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/parse-test" className="rounded-lg border border-gray-300 bg-white px-4 py-2 hover:bg-gray-50">直接测试 FastAPI</Link>
            <Link href="/dashboard" className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">返回 Dashboard</Link>
          </div>
        </div>
        <ParseRunDashboard />
      </div>
    </main>
  )
}
