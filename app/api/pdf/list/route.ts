import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getErrorMessage } from '@/lib/utils/errors'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取用户的 PDF 列表
    const { data: pdfs, error } = await supabase
      .from('pdfs')
      .select('id,file_name,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ pdfs })
  } catch (error: unknown) {
    console.error('List PDFs error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, '文件列表读取失败') },
      { status: 500 }
    )
  }
}
