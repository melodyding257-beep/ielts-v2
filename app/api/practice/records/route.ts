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

    // 获取做题记录，包含 PDF 信息
    const { data: records, error } = await supabase
      .from('practice_records')
      .select(`
        *,
        pdfs (
          id,
          file_name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ records })
  } catch (error: unknown) {
    console.error('List records error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, '练习记录读取失败') },
      { status: 500 }
    )
  }
}
