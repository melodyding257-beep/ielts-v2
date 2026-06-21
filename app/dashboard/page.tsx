import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UploadSection from '@/components/dashboard/UploadSection'
import FileList from '@/components/dashboard/FileList'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 如果未登录，重定向到登录页
  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            IELTS Reading Practice · 雅思阅读机考平台
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{user.email}</div>
                <div className="text-xs text-gray-500">已登录</div>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-gray-600 hover:text-black transition-colors"
              >
                退出登录
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">我的练习</h2>
          <p className="text-gray-600">上传 PDF 或图片文件开始练习</p>
        </div>

        {/* 上传区域 */}
        <UploadSection />

        {/* 已上传文件列表 */}
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-4">我的文件</h3>
          <FileList />
        </div>
      </main>
    </div>
  )
}
